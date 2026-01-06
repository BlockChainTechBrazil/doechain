/**
 * NotificationService - Gerencia notificações de óbito
 */

const crypto = require('crypto');
const { ethers } = require('ethers');
const { getDatabase } = require('../config/database');
const relayerService = require('./RelayerService');
const deathNotificationABI = require('../abi/DeathNotificationRegistryABI.json');
const contracts = require('../config/contracts');
const { currentNetwork } = require('../config/networks');

class NotificationService {
  /**
   * Cria hash anonimizado do paciente
   */
  createPatientHash(cpf, name, birthDate) {
    const data = `${cpf}|${name}|${birthDate}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Criptografa CPF para armazenamento
   */
  encryptCPF(cpf) {
    // Em produção, usar criptografia adequada (AES-256)
    // Por simplicidade, usando base64 aqui
    return Buffer.from(cpf).toString('base64');
  }

  /**
   * Cria nova notificação de óbito (manual)
   */
  async createNotification(data, userId) {
    const db = getDatabase();
    const {
      patientName,
      patientCPF,
      patientAge,
      patientGender,
      deathDatetime,
      deathCause,
      deathLocation,
      pcrConfirmed,
      institutionId,
      notes,
      // Campos de família e consentimento
      familyContact,
      familyPhone,
      familyRelationship,
      familyConsent,
      familyNotified, // Novo campo do edital: família já foi comunicada
      contraindications
    } = data;

    // Criar hash anonimizado
    const patientHash = this.createPatientHash(patientCPF, patientName, '');
    const cpfEncrypted = this.encryptCPF(patientCPF);

    // Converter familyConsent para inteiro: true=1, false=0, null=null
    let familyConsentValue = null;
    if (familyConsent === true) familyConsentValue = 1;
    else if (familyConsent === false) familyConsentValue = 0;

    const stmt = db.prepare(`
      INSERT INTO death_notifications (
        patient_hash, patient_name, patient_cpf_encrypted, patient_age, patient_gender,
        death_datetime, death_cause, death_location, pcr_confirmed,
        notified_by_user_id, institution_id, notes, source, is_automatic,
        family_contact, family_phone, family_relationship, family_consent,
        family_notified, family_notified_at, family_notified_by,
        contraindications
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 0, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      patientHash, patientName, cpfEncrypted, patientAge, patientGender,
      deathDatetime, deathCause, deathLocation, pcrConfirmed ? 1 : 0,
      userId, institutionId, notes,
      familyContact || null,
      familyPhone || null,
      familyRelationship || null,
      familyConsentValue,
      familyNotified ? 1 : 0,
      familyNotified ? new Date().toISOString() : null,
      familyNotified ? userId : null,
      contraindications ? JSON.stringify(contraindications) : null
    );

    // Log de auditoria
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, 'create_notification', 'death_notification', ?, ?)
    `).run(userId, result.lastInsertRowid, JSON.stringify({ patientHash, deathDatetime, source: 'manual' }));

    return this.getNotificationById(result.lastInsertRowid);
  }

  /**
   * Cria notificação automática (via integração MV)
   */
  async createAutomaticNotification(mvData, userId) {
    const db = getDatabase();
    const {
      mv_id,
      prontuario,
      atendimento,
      patient_name,
      patient_cpf,
      patient_age,
      patient_gender,
      death_datetime,
      death_cause,
      death_location,
      pcr_confirmed,
      hospital_id,
      contraindications
    } = mvData;

    // Verificar se já existe notificação com este mv_id
    const existing = db.prepare('SELECT id FROM death_notifications WHERE mv_id = ?').get(mv_id);
    if (existing) {
      console.log(`[MV] Notificação já existe para mv_id: ${mv_id}`);
      return this.getNotificationById(existing.id);
    }

    // Buscar instituição pelo ID do hospital MV ou usar a primeira disponível
    let institutionId = hospital_id;
    const institution = db.prepare('SELECT id FROM institutions WHERE id = ? AND active = 1').get(hospital_id);
    if (!institution) {
      // Usar primeira instituição ativa se não encontrar
      const firstInst = db.prepare('SELECT id FROM institutions WHERE active = 1 LIMIT 1').get();
      institutionId = firstInst ? firstInst.id : 1;
    }

    // Criar hash anonimizado
    const patientHash = this.createPatientHash(patient_cpf.replace(/\D/g, ''), patient_name, '');
    const cpfEncrypted = this.encryptCPF(patient_cpf.replace(/\D/g, ''));

    const stmt = db.prepare(`
      INSERT INTO death_notifications (
        patient_hash, patient_name, patient_cpf_encrypted, patient_age, patient_gender,
        death_datetime, death_cause, death_location, pcr_confirmed,
        notified_by_user_id, institution_id, notes,
        source, is_automatic, mv_id, mv_prontuario, mv_atendimento
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'mv', 1, ?, ?, ?)
    `);

    const notes = contraindications && contraindications.length > 0
      ? `Contraindicações: ${contraindications.join(', ')}`
      : 'Notificação automática via integração MV';

    const result = stmt.run(
      patientHash, patient_name, cpfEncrypted, patient_age, patient_gender,
      death_datetime, death_cause, death_location, pcr_confirmed ? 1 : 0,
      userId, institutionId, notes,
      mv_id, prontuario, atendimento
    );

    // Log de auditoria
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, 'create_automatic_notification', 'death_notification', ?, ?)
    `).run(userId, result.lastInsertRowid, JSON.stringify({ patientHash, mv_id, source: 'mv' }));

    return this.getNotificationById(result.lastInsertRowid);
  }

  /**
   * Verifica se uma notificação é editável
   */
  isEditable(notification) {
    // Notificações automáticas não podem ser editadas
    if (notification.is_automatic || notification.source === 'mv') {
      return false;
    }
    // Notificações já confirmadas na blockchain não podem ser editadas
    if (notification.blockchain_confirmed) {
      return false;
    }
    return true;
  }

  /**
   * Marca notificação como lida
   */
  markAsRead(notificationId, userId) {
    const db = getDatabase();

    const notification = this.getNotificationById(notificationId);
    if (!notification) {
      throw new Error('Notificação não encontrada');
    }

    // Só marca se ainda não foi lida
    if (!notification.is_read) {
      db.prepare(`
        UPDATE death_notifications 
        SET is_read = 1, read_at = CURRENT_TIMESTAMP, read_by_user_id = ?
        WHERE id = ?
      `).run(userId, notificationId);

      // Log de auditoria
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
        VALUES (?, 'mark_as_read', 'death_notification', ?, ?)
      `).run(userId, notificationId, JSON.stringify({ read_at: new Date().toISOString() }));
    }

    return this.getNotificationById(notificationId);
  }

  /**
   * Marca múltiplas notificações como lidas
   */
  markAllAsRead(userId, filters = {}) {
    const db = getDatabase();

    let query = 'UPDATE death_notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP, read_by_user_id = ? WHERE is_read = 0';
    const params = [userId];

    if (filters.institutionId) {
      query += ' AND institution_id = ?';
      params.push(filters.institutionId);
    }

    const result = db.prepare(query).run(...params);
    return { markedCount: result.changes };
  }

  /**
   * Marca família como comunicada (requisito crítico do edital)
   * Este é o momento em que a equipe conversa com a família sobre doação
   */
  markFamilyNotified(notificationId, userId) {
    const db = getDatabase();

    const notification = this.getNotificationById(notificationId);
    if (!notification) {
      throw new Error('Notificação não encontrada');
    }

    if (notification.family_notified) {
      throw new Error('Família já foi comunicada anteriormente');
    }

    db.prepare(`
      UPDATE death_notifications 
      SET family_notified = 1, 
          family_notified_at = CURRENT_TIMESTAMP, 
          family_notified_by = ?
      WHERE id = ?
    `).run(userId, notificationId);

    // Log de auditoria
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, 'family_notified', 'death_notification', ?, ?)
    `).run(userId, notificationId, JSON.stringify({
      family_notified_at: new Date().toISOString(),
      family_notified_by: userId
    }));

    return this.getNotificationById(notificationId);
  }

  /**
   * Atualiza status da córnea (avaliação, coleta, transplante)
   * @param {number} notificationId - ID da notificação
   * @param {string} action - 'evaluated', 'collected', 'transplanted'
   * @param {string} eye - 'left', 'right', 'both'
   * @param {string} notes - Observações
   * @param {number} userId - Usuário que atualizou
   */
  updateCorneaStatus(notificationId, action, eye = 'both', notes = '', userId) {
    const db = getDatabase();

    const notification = this.getNotificationById(notificationId);
    if (!notification) {
      throw new Error('Notificação não encontrada');
    }

    // Verificar se córnea é viável
    if (!notification.cornea_viable) {
      throw new Error('Córnea não está marcada como viável para esta notificação');
    }

    const now = new Date().toISOString();
    const updates = [];
    const params = [];

    switch (action) {
      case 'evaluated':
        updates.push('evaluation_datetime = ?');
        params.push(now);
        break;

      case 'collected':
        // Atualiza campos de coleta baseado no olho
        updates.push('collection_datetime = ?');
        params.push(now);

        if (eye === 'left' || eye === 'both') {
          updates.push('cornea_left_collected = 1');
        }
        if (eye === 'right' || eye === 'both') {
          updates.push('cornea_right_collected = 1');
        }
        break;

      case 'transplanted':
        // Atualiza campos de transplante baseado no olho
        updates.push('transplant_datetime = ?');
        params.push(now);

        if (eye === 'left' || eye === 'both') {
          updates.push('cornea_left_transplanted = 1');
        }
        if (eye === 'right' || eye === 'both') {
          updates.push('cornea_right_transplanted = 1');
        }
        break;

      default:
        throw new Error('Ação inválida');
    }

    if (notes) {
      updates.push('notes = COALESCE(notes, \'\') || ? ');
      params.push(`\n[${action.toUpperCase()} ${now}] ${notes}`);
    }

    params.push(notificationId);

    db.prepare(`
      UPDATE death_notifications 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...params);

    // Log de auditoria
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, ?, 'death_notification', ?, ?)
    `).run(userId, `cornea_${action}`, notificationId, JSON.stringify({
      action, eye, notes, datetime: now
    }));

    return this.getNotificationById(notificationId);
  }

  /**
   * Conta notificações não lidas
   */
  countUnread(filters = {}) {
    const db = getDatabase();

    let query = 'SELECT COUNT(*) as count FROM death_notifications WHERE is_read = 0';
    const params = [];

    if (filters.institutionId) {
      query += ' AND institution_id = ?';
      params.push(filters.institutionId);
    }

    const result = db.prepare(query).get(...params);
    return result.count;
  }

  /**
   * Atualiza status de córnea
   */
  updateCorneaStatus(notificationId, leftStatus, rightStatus, userId) {
    const db = getDatabase();
    const old = this.getNotificationById(notificationId);

    db.prepare(`
      UPDATE death_notifications 
      SET cornea_left_status = ?, cornea_right_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(leftStatus, rightStatus, notificationId);

    // Log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (?, 'update_cornea_status', 'death_notification', ?, ?, ?)
    `).run(
      userId,
      notificationId,
      JSON.stringify({ left: old.cornea_left_status, right: old.cornea_right_status }),
      JSON.stringify({ left: leftStatus, right: rightStatus })
    );

    return this.getNotificationById(notificationId);
  }

  /**
   * Registra consentimento familiar
   */
  registerConsent(notificationId, consent, consentBy, userId) {
    const db = getDatabase();
    db.prepare(`
      UPDATE death_notifications 
      SET family_consent = ?, consent_datetime = CURRENT_TIMESTAMP, consent_by = ?,
          cornea_viable = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(consent ? 1 : 0, consentBy, consent ? 1 : 0, notificationId);

    // Log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, 'register_consent', 'death_notification', ?, ?)
    `).run(userId, notificationId, JSON.stringify({ consent, consentBy }));

    return this.getNotificationById(notificationId);
  }

  /**
   * Registra na blockchain
   */
  async registerOnBlockchain(notificationId, userId) {
    const notification = this.getNotificationById(notificationId);

    if (!notification) {
      throw new Error('Notificação não encontrada');
    }

    if (notification.blockchain_tx_hash) {
      throw new Error('Notificação já registrada na blockchain');
    }

    // Verificar se relayer está configurado
    if (!relayerService.isConfigured()) {
      throw new Error('Relayer não configurado. Contate o administrador.');
    }

    // Verificar saldo do relayer
    const hasBalance = await relayerService.hasEnoughBalance();
    if (!hasBalance) {
      throw new Error('Saldo insuficiente no relayer para pagar gas. Contate o administrador.');
    }

    // Verificar se contrato está configurado
    if (!contracts.deathNotification) {
      throw new Error('Contrato DeathNotificationRegistry não configurado.');
    }

    const db = getDatabase();

    try {
      // Atualizar status para pendente
      db.prepare(`
        UPDATE death_notifications 
        SET status = 'pending', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(notificationId);

      // Preparar dados para blockchain
      const patientHashBytes = '0x' + notification.patient_hash;
      const deathTimestamp = Math.floor(new Date(notification.death_datetime).getTime() / 1000);
      const ipfsHash = ''; // Sem IPFS por enquanto

      console.log(`📤 Enviando notificação ${notificationId} para blockchain...`);
      console.log(`   PatientHash: ${patientHashBytes}`);
      console.log(`   DeathTimestamp: ${deathTimestamp}`);

      // Usar wallet do relayerService
      const wallet = relayerService.getWallet();
      if (!wallet) {
        throw new Error('Wallet do relayer não disponível');
      }

      const contract = new ethers.Contract(
        contracts.deathNotification,
        deathNotificationABI,
        wallet
      );

      // Enviar transação
      const tx = await contract.notifyDeath(patientHashBytes, deathTimestamp, ipfsHash);
      console.log(`📝 TX enviada: ${tx.hash}`);

      // Atualizar banco com hash da transação e marcar como confirmado na blockchain
      db.prepare(`
        UPDATE death_notifications 
        SET blockchain_tx_hash = ?, status = 'confirmed', blockchain_confirmed = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(tx.hash, notificationId);

      // Registrar transação
      db.prepare(`
        INSERT INTO blockchain_transactions (tx_type, tx_hash, from_address, to_address, status, related_notification_id)
        VALUES ('death_notification', ?, ?, ?, 'pending', ?)
      `).run(tx.hash, wallet.address, contracts.deathNotification, notificationId);

      // Log de auditoria (sem coluna details)
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
        VALUES (?, 'submit_to_blockchain', 'death_notification', ?)
      `).run(userId, notificationId);

      // Aguardar confirmação em background (não bloquear a resposta)
      this.waitForBlockchainConfirmation(tx.hash, notificationId);

      console.log(`✅ Notificação ${notificationId} enviada para blockchain: ${tx.hash}`);

      return {
        ...this.getNotificationById(notificationId),
        txHash: tx.hash
      };

    } catch (error) {
      console.error(`❌ Erro ao enviar para blockchain: ${error.message}`);

      // Reverter status para pending (status válido no banco)
      db.prepare(`
        UPDATE death_notifications 
        SET status = 'pending', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(notificationId);

      // Extrair mensagem de erro mais amigável
      let errorMessage = error.message;
      if (error.reason) {
        errorMessage = error.reason;
      }

      // Erros comuns com mensagens amigáveis
      if (errorMessage.includes('Usuario sem instituicao')) {
        errorMessage = 'Relayer não está cadastrado no contrato. O administrador precisa configurar a role e instituição do relayer no smart contract.';
      } else if (errorMessage.includes('Nao autorizado')) {
        errorMessage = 'Relayer não tem permissão para notificar óbitos no contrato.';
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Saldo insuficiente no relayer para pagar o gas da transação.';
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Aguarda confirmação da transação em background
   */
  async waitForBlockchainConfirmation(txHash, notificationId) {
    try {
      const provider = new ethers.JsonRpcProvider(currentNetwork.rpcUrl);
      const receipt = await provider.waitForTransaction(txHash, 1, 60000);

      if (receipt) {
        const db = getDatabase();
        db.prepare(`
          UPDATE blockchain_transactions 
          SET status = 'confirmed', 
              block_number = ?, 
              gas_used = ?,
              confirmed_at = CURRENT_TIMESTAMP
          WHERE tx_hash = ?
        `).run(receipt.blockNumber, receipt.gasUsed.toString(), txHash);

        console.log(`✅ TX ${txHash} confirmada no bloco ${receipt.blockNumber}`);
      }
    } catch (error) {
      console.error(`❌ Erro aguardando confirmação: ${error.message}`);
    }
  }

  /**
   * Busca notificação por ID
   */
  getNotificationById(id) {
    const db = getDatabase();
    return db.prepare(`
      SELECT n.*, 
             u.name as notified_by_name,
             i.name as institution_name,
             i.type as institution_type
      FROM death_notifications n
      LEFT JOIN users u ON n.notified_by_user_id = u.id
      LEFT JOIN institutions i ON n.institution_id = i.id
      WHERE n.id = ?
    `).get(id);
  }

  /**
   * Lista notificações com filtros
   */
  listNotifications(filters = {}) {
    const db = getDatabase();
    let query = `
      SELECT n.id, n.patient_hash, n.patient_name, n.patient_age, n.patient_gender,
             n.death_datetime, n.pcr_confirmed, n.cornea_viable,
             n.cornea_left_status, n.cornea_right_status,
             n.family_consent, n.status, n.blockchain_tx_hash,
             n.notification_datetime, n.source, n.is_automatic, n.mv_id,
             n.is_read, n.read_at,
             u.name as notified_by_name,
             i.name as institution_name, i.type as institution_type
      FROM death_notifications n
      LEFT JOIN users u ON n.notified_by_user_id = u.id
      LEFT JOIN institutions i ON n.institution_id = i.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ' AND n.status = ?';
      params.push(filters.status);
    }

    if (filters.institutionId) {
      query += ' AND n.institution_id = ?';
      params.push(filters.institutionId);
    }

    if (filters.corneaViable !== undefined) {
      query += ' AND n.cornea_viable = ?';
      params.push(filters.corneaViable ? 1 : 0);
    }

    if (filters.startDate) {
      query += ' AND n.death_datetime >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND n.death_datetime <= ?';
      params.push(filters.endDate);
    }

    if (filters.source) {
      query += ' AND n.source = ?';
      params.push(filters.source);
    }

    if (filters.isAutomatic !== undefined) {
      query += ' AND n.is_automatic = ?';
      params.push(filters.isAutomatic ? 1 : 0);
    }

    // Filtro de família notificada (para filtro de urgentes)
    if (filters.familyNotified !== undefined) {
      if (filters.familyNotified === false || filters.familyNotified === 'false') {
        query += ' AND (n.family_notified IS NULL OR n.family_notified = 0)';
      } else {
        query += ' AND n.family_notified = 1';
      }
    }

    query += ' ORDER BY n.notification_datetime DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }

  /**
   * Estatísticas do dashboard - KPIs do Edital CPSI
   */
  getStatistics(institutionId = null) {
    const db = getDatabase();
    const whereClause = institutionId ? 'WHERE institution_id = ?' : '';
    const andClause = institutionId ? 'AND institution_id = ?' : '';
    const params = institutionId ? [institutionId] : [];

    // Contagens básicas
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications ${whereClause}
    `).get(...params);

    const viable = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} cornea_viable = 1
    `).get(...params);

    const pending = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} status = 'pending'
    `).get(...params);

    const confirmed = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} blockchain_confirmed = 1
    `).get(...params);

    const today = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} date(notification_datetime) = date('now')
    `).get(...params);

    // KPIs do Edital - Notificações Automatizadas vs Manuais
    const automatic = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} is_automatic = 1
    `).get(...params);

    const manual = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} is_automatic = 0
    `).get(...params);

    // KPIs do Edital - Córneas por Status
    const corneaCollectedLeft = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} cornea_left_status = 'collected'
    `).get(...params);

    const corneaCollectedRight = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} cornea_right_status = 'collected'
    `).get(...params);

    const corneaTransplantedLeft = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} cornea_left_status = 'transplanted'
    `).get(...params);

    const corneaTransplantedRight = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} cornea_right_status = 'transplanted'
    `).get(...params);

    // KPIs do Edital - Consentimento Familiar
    const consentGranted = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} family_consent = 1
    `).get(...params);

    const consentRefused = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} family_consent = 0
    `).get(...params);

    const consentPending = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} family_consent IS NULL
    `).get(...params);

    // KPIs do Edital - Comunicação à Família (momento crítico)
    const familyNotified = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} family_notified = 1
    `).get(...params);

    const familyNotNotified = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} (family_notified = 0 OR family_notified IS NULL)
    `).get(...params);

    // KPIs do Edital - Tempo Médio (em minutos)
    const avgTimeToNotification = db.prepare(`
      SELECT AVG(
        (julianday(notification_datetime) - julianday(death_datetime)) * 24 * 60
      ) as avg_minutes
      FROM death_notifications 
      WHERE notification_datetime IS NOT NULL AND death_datetime IS NOT NULL
      ${andClause}
    `).get(...params);

    const avgTimeToConsent = db.prepare(`
      SELECT AVG(
        (julianday(consent_datetime) - julianday(notification_datetime)) * 24 * 60
      ) as avg_minutes
      FROM death_notifications 
      WHERE consent_datetime IS NOT NULL AND notification_datetime IS NOT NULL
      ${andClause}
    `).get(...params);

    const avgTimeToCollection = db.prepare(`
      SELECT AVG(
        (julianday(collection_datetime) - julianday(death_datetime)) * 24 * 60
      ) as avg_minutes
      FROM death_notifications 
      WHERE collection_datetime IS NOT NULL AND death_datetime IS NOT NULL
      ${andClause}
    `).get(...params);

    // Alertas urgentes - Notificações onde família não foi comunicada e passou tempo
    const urgentNotifications = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      WHERE status = 'pending' 
        AND (family_notified = 0 OR family_notified IS NULL)
        AND (julianday('now') - julianday(death_datetime)) * 24 < 6
      ${andClause}
    `).get(...params);

    // Estatísticas por período (últimos 7 dias, 30 dias)
    const last7Days = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      WHERE notification_datetime >= datetime('now', '-7 days')
      ${andClause}
    `).get(...params);

    const last30Days = db.prepare(`
      SELECT COUNT(*) as count FROM death_notifications 
      WHERE notification_datetime >= datetime('now', '-30 days')
      ${andClause}
    `).get(...params);

    // Por fonte (para gráfico de pizza)
    const bySource = db.prepare(`
      SELECT source, COUNT(*) as count FROM death_notifications 
      ${whereClause}
      GROUP BY source
    `).all(...params);

    // Por status (para gráfico de pizza)
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM death_notifications 
      ${whereClause}
      GROUP BY status
    `).all(...params);

    return {
      // Métricas básicas
      total: total.count,
      corneaViable: viable.count,
      pending: pending.count,
      blockchainConfirmed: confirmed.count,
      today: today.count,

      // KPIs do Edital - Automação
      automatic: automatic.count,
      manual: manual.count,
      automaticRate: total.count > 0 ? Math.round((automatic.count / total.count) * 100) : 0,

      // KPIs do Edital - Córneas
      corneaCollected: corneaCollectedLeft.count + corneaCollectedRight.count,
      corneaTransplanted: corneaTransplantedLeft.count + corneaTransplantedRight.count,
      corneaCollectedLeft: corneaCollectedLeft.count,
      corneaCollectedRight: corneaCollectedRight.count,
      corneaTransplantedLeft: corneaTransplantedLeft.count,
      corneaTransplantedRight: corneaTransplantedRight.count,

      // KPIs do Edital - Consentimento
      consentGranted: consentGranted.count,
      consentRefused: consentRefused.count,
      consentPending: consentPending.count,
      consentRate: (consentGranted.count + consentRefused.count) > 0
        ? Math.round((consentGranted.count / (consentGranted.count + consentRefused.count)) * 100)
        : 0,

      // KPIs do Edital - Comunicação à Família
      familyNotified: familyNotified.count,
      familyNotNotified: familyNotNotified.count,

      // KPIs do Edital - Tempos Médios (em minutos)
      avgTimeToNotification: avgTimeToNotification.avg_minutes ? Math.round(avgTimeToNotification.avg_minutes) : null,
      avgTimeToConsent: avgTimeToConsent.avg_minutes ? Math.round(avgTimeToConsent.avg_minutes) : null,
      avgTimeToCollection: avgTimeToCollection.avg_minutes ? Math.round(avgTimeToCollection.avg_minutes) : null,

      // Alertas
      urgentNotifications: urgentNotifications.count,

      // Períodos
      last7Days: last7Days.count,
      last30Days: last30Days.count,

      // Para gráficos
      bySource: bySource.reduce((acc, item) => ({ ...acc, [item.source]: item.count }), {}),
      byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item.status]: item.count }), {})
    };
  }

  /**
   * Busca notificações com transações pendentes de confirmação
   */
  getPendingBlockchainNotifications() {
    const db = getDatabase();
    return db.prepare(`
      SELECT n.id, n.patient_name, n.blockchain_tx_hash, n.blockchain_confirmed, n.status,
             bt.status as tx_status, bt.block_number
      FROM death_notifications n
      LEFT JOIN blockchain_transactions bt ON n.blockchain_tx_hash = bt.tx_hash
      WHERE n.blockchain_tx_hash IS NOT NULL 
        AND (n.blockchain_confirmed = 0 OR n.blockchain_confirmed IS NULL)
      ORDER BY n.id DESC
    `).all();
  }

  /**
   * Verifica e atualiza status das transações pendentes
   */
  async checkPendingTransactions() {
    const db = getDatabase();
    const pending = this.getPendingBlockchainNotifications();
    const updated = [];

    if (pending.length === 0) {
      return { updated: [], pending: 0 };
    }

    const provider = new ethers.JsonRpcProvider(currentNetwork.rpcUrl);

    for (const notification of pending) {
      try {
        const receipt = await provider.getTransactionReceipt(notification.blockchain_tx_hash);

        if (receipt && receipt.status === 1) {
          // Transação confirmada com sucesso
          db.prepare(`
            UPDATE death_notifications 
            SET blockchain_confirmed = 1, status = 'confirmed', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(notification.id);

          db.prepare(`
            UPDATE blockchain_transactions 
            SET status = 'confirmed', 
                block_number = ?, 
                gas_used = ?,
                confirmed_at = CURRENT_TIMESTAMP
            WHERE tx_hash = ?
          `).run(receipt.blockNumber, receipt.gasUsed.toString(), notification.blockchain_tx_hash);

          updated.push({
            id: notification.id,
            txHash: notification.blockchain_tx_hash,
            blockNumber: receipt.blockNumber,
            status: 'confirmed'
          });

          console.log(`✅ Notificação #${notification.id} confirmada no bloco ${receipt.blockNumber}`);
        } else if (receipt && receipt.status === 0) {
          // Transação falhou
          db.prepare(`
            UPDATE blockchain_transactions 
            SET status = 'failed', confirmed_at = CURRENT_TIMESTAMP
            WHERE tx_hash = ?
          `).run(notification.blockchain_tx_hash);

          updated.push({
            id: notification.id,
            txHash: notification.blockchain_tx_hash,
            status: 'failed'
          });

          console.log(`❌ Transação da notificação #${notification.id} falhou`);
        }
        // Se receipt é null, a transação ainda está pendente
      } catch (error) {
        console.error(`Erro ao verificar tx ${notification.blockchain_tx_hash}:`, error.message);
      }
    }

    return {
      updated,
      pending: pending.length - updated.length
    };
  }
}

module.exports = new NotificationService();

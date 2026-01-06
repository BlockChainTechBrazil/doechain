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
   * Cria nova notificação de óbito
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
      notes
    } = data;

    // Criar hash anonimizado
    const patientHash = this.createPatientHash(patientCPF, patientName, '');
    const cpfEncrypted = this.encryptCPF(patientCPF);

    const stmt = db.prepare(`
      INSERT INTO death_notifications (
        patient_hash, patient_name, patient_cpf_encrypted, patient_age, patient_gender,
        death_datetime, death_cause, death_location, pcr_confirmed,
        notified_by_user_id, institution_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      patientHash, patientName, cpfEncrypted, patientAge, patientGender,
      deathDatetime, deathCause, deathLocation, pcrConfirmed ? 1 : 0,
      userId, institutionId, notes
    );

    // Log de auditoria
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, 'create_notification', 'death_notification', ?, ?)
    `).run(userId, result.lastInsertRowid, JSON.stringify({ patientHash, deathDatetime }));

    return this.getNotificationById(result.lastInsertRowid);
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

      // Criar instância do contrato com a wallet do relayer
      const provider = new ethers.JsonRpcProvider(currentNetwork.rpcUrl);
      const wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
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
      SELECT n.id, n.patient_hash, n.patient_age, n.patient_gender,
             n.death_datetime, n.pcr_confirmed, n.cornea_viable,
             n.cornea_left_status, n.cornea_right_status,
             n.family_consent, n.status, n.blockchain_tx_hash,
             n.notification_datetime,
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

    query += ' ORDER BY n.notification_datetime DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }

  /**
   * Estatísticas do dashboard
   */
  getStatistics(institutionId = null) {
    const db = getDatabase();
    const whereClause = institutionId ? 'WHERE institution_id = ?' : '';
    const params = institutionId ? [institutionId] : [];

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

    return {
      total: total.count,
      corneaViable: viable.count,
      pending: pending.count,
      blockchainConfirmed: confirmed.count,
      today: today.count
    };
  }
}

module.exports = new NotificationService();

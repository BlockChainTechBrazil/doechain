/**
 * Script para sincronizar dados DA blockchain para o banco local
 * Lê as notificações registradas no smart contract e importa para o SQLite
 */

const { ethers } = require('ethers');
const { getDatabase, initDatabase } = require('../config/database');
const contracts = require('../config/contracts');
const { currentNetwork } = require('../config/networks');
const deathNotificationABI = require('../abi/DeathNotificationRegistryABI.json');

async function syncFromBlockchain() {
  console.log('⛓️  Sincronizando dados DA blockchain...\n');

  // Inicializar banco (é async)
  await initDatabase();
  const db = getDatabase();

  // Conectar à blockchain
  const provider = new ethers.JsonRpcProvider(currentNetwork.rpcUrl);
  const contract = new ethers.Contract(
    contracts.deathNotification,
    deathNotificationABI,
    provider
  );

  console.log(`📡 Conectado à rede: ${currentNetwork.name}`);
  console.log(`📄 Contrato: ${contracts.deathNotification}\n`);

  try {
    // Obter total de notificações na blockchain
    const totalOnChain = await contract.notificationCount();
    console.log(`📊 Total de notificações na blockchain: ${totalOnChain}\n`);

    if (totalOnChain === 0n) {
      console.log('ℹ️  Nenhuma notificação encontrada na blockchain.');
      return;
    }

    // Buscar eventos DeathNotified para obter os tx hashes
    // Sepolia tem limite de 50000 blocos por query
    console.log('🔍 Buscando eventos da blockchain...');
    const filter = contract.filters.DeathNotified();

    // Buscar o bloco atual e calcular o range
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 49000); // Últimos 49000 blocos

    const events = await contract.queryFilter(filter, fromBlock, 'latest');

    // Criar mapa de notification_id -> txHash
    const txHashMap = new Map();
    for (const event of events) {
      const notifId = Number(event.args[0]); // primeiro arg é o id
      txHashMap.set(notifId, event.transactionHash);
    }
    console.log(`   ✅ ${events.length} eventos encontrados (blocos ${fromBlock} a ${currentBlock})\n`);

    // Verificar quais já existem no banco local
    const existingHashes = new Set();
    const existingRows = db.prepare('SELECT blockchain_notification_id FROM death_notifications WHERE blockchain_notification_id IS NOT NULL').all();
    existingRows.forEach(row => existingHashes.add(row.blockchain_notification_id));

    console.log(`💾 Notificações já sincronizadas: ${existingHashes.size}`);

    let imported = 0;
    let skipped = 0;

    // Iterar por todas as notificações na blockchain
    for (let i = 1n; i <= totalOnChain; i++) {
      const id = Number(i);

      // Pular se já existe
      if (existingHashes.has(id)) {
        skipped++;
        continue;
      }

      try {
        // Buscar dados da blockchain
        const notification = await contract.getNotification(i);

        // Desestruturar dados
        const [
          notifId,
          patientHash,
          deathTimestamp,
          notificationTimestamp,
          notifiedBy,
          institutionId,
          leftEyeStatus,
          rightEyeStatus,
          familyConsent,
          status,
          ipfsHash
        ] = notification;

        // Converter timestamps
        const deathDatetime = new Date(Number(deathTimestamp) * 1000).toISOString();
        const notificationDatetime = new Date(Number(notificationTimestamp) * 1000).toISOString();

        // Converter status de córnea
        const corneaStatusMap = ['not_evaluated', 'viable', 'not_viable', 'collected', 'transplanted'];
        const leftStatus = corneaStatusMap[Number(leftEyeStatus)] || 'not_evaluated';
        const rightStatus = corneaStatusMap[Number(rightEyeStatus)] || 'not_evaluated';

        // Determinar se córnea é viável
        const corneaViable = leftStatus === 'viable' || rightStatus === 'viable' ||
          leftStatus === 'collected' || rightStatus === 'collected' ||
          leftStatus === 'transplanted' || rightStatus === 'transplanted';

        // Verificar/criar instituição
        let localInstitutionId = Number(institutionId);
        const instExists = db.prepare('SELECT id FROM institutions WHERE id = ?').get(localInstitutionId);
        if (!instExists) {
          // Criar instituição genérica
          db.prepare(`
            INSERT INTO institutions (id, name, cnes, type, active) 
            VALUES (?, ?, ?, ?, 1)
          `).run(localInstitutionId, `Instituição #${localInstitutionId}`, `000000${localInstitutionId}`, 'hospital');
          console.log(`  ✅ Instituição #${localInstitutionId} criada`);
        }

        // Buscar tx hash real do evento
        const txHash = txHashMap.get(id) || null;

        // Inserir no banco local
        db.prepare(`
          INSERT INTO death_notifications (
            patient_hash, patient_name, 
            death_datetime, notification_datetime,
            cornea_viable, cornea_left_status, cornea_right_status,
            family_consent,
            notified_by_user_id, institution_id,
            source, is_automatic,
            blockchain_tx_hash, blockchain_notification_id, blockchain_confirmed,
            notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          patientHash,  // bytes32 como hex string
          `Paciente Blockchain #${id}`,
          deathDatetime,
          notificationDatetime,
          corneaViable ? 1 : 0,
          leftStatus,
          rightStatus,
          familyConsent === true ? 1 : null, // false na blockchain = ainda não registrado = null (pendente)
          1, // admin user
          localInstitutionId,
          'api', // fonte importada da blockchain
          1, // considerado automático
          txHash, // tx hash real da blockchain
          id, // blockchain_notification_id
          1, // já confirmado
          `Importado da blockchain em ${new Date().toISOString()}. Córnea esquerda: ${leftStatus}, direita: ${rightStatus}. Notifier: ${notifiedBy}`
        );

        imported++;
        console.log(`  📥 Notificação #${id} importada (tx: ${txHash ? txHash.substring(0, 16) + '...' : 'N/A'})`);

      } catch (err) {
        console.error(`  ❌ Erro ao importar #${id}: ${err.message}`);
      }
    }

    console.log(`\n✨ Sincronização concluída!`);
    console.log(`   📥 Importadas: ${imported}`);
    console.log(`   ⏭️  Já existiam: ${skipped}`);
    console.log(`   📊 Total na blockchain: ${totalOnChain}`);

  } catch (error) {
    console.error('❌ Erro ao sincronizar:', error.message);

    if (error.message.includes('could not decode result')) {
      console.log('\n⚠️  Possíveis causas:');
      console.log('   - Contrato não tem notificações ainda');
      console.log('   - ABI incompatível com o contrato deployado');
      console.log('   - Endereço do contrato incorreto');
    }
  }
}

// Executar
syncFromBlockchain().catch(console.error);

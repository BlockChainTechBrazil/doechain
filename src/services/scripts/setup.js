/**
 * Setup completo do DoeChain
 * Inicializa o sistema do zero com todos os dados necessários
 * 
 * Uso: npm run setup
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '../../../data');
const DB_PATH = path.join(DATA_DIR, 'doechain.db');

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏥 DoeChain - Setup Completo                            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

async function setup() {
  const args = process.argv.slice(2);
  const forceReset = args.includes('--force') || args.includes('-f');
  const skipBlockchain = args.includes('--skip-blockchain') || args.includes('-s');
  const withMockData = args.includes('--mock') || args.includes('-m');

  // Verificar se banco já existe
  if (fs.existsSync(DB_PATH) && !forceReset) {
    console.log('⚠️  Banco de dados já existe!');
    console.log('   Use --force para resetar completamente');
    console.log('   Ou execute: npm run setup -- --force\n');
    process.exit(0);
  }

  try {
    // 1. Remover banco antigo
    console.log('🗑️  Passo 1/4: Limpando dados antigos...');
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
      console.log('   ✅ Banco de dados removido\n');
    } else {
      console.log('   ✅ Nenhum banco anterior encontrado\n');
    }

    // 2. Inicializar banco
    console.log('📦 Passo 2/4: Criando banco de dados...');
    require('./init-db');
    console.log('');

    // 3. Criar admin
    console.log('👤 Passo 3/4: Criando usuário administrador...');
    // Aguardar um pouco para o banco ser salvo
    await new Promise(resolve => setTimeout(resolve, 500));
    require('./create-admin');
    console.log('');

    // 4. Sincronizar blockchain (se não pular)
    if (!skipBlockchain) {
      console.log('⛓️  Passo 4/4: Sincronizando dados da blockchain...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Importar e executar o sync
      const { ethers } = require('ethers');
      const { getDatabase, initDatabase } = require('../config/database');
      const contracts = require('../config/contracts');
      const { currentNetwork } = require('../config/networks');
      const deathNotificationABI = require('../abi/DeathNotificationRegistryABI.json');

      await initDatabase();
      const db = getDatabase();

      const provider = new ethers.JsonRpcProvider(currentNetwork.rpcUrl);
      const contract = new ethers.Contract(
        contracts.deathNotification,
        deathNotificationABI,
        provider
      );

      try {
        const totalOnChain = await contract.notificationCount();
        console.log(`   📊 Encontradas ${totalOnChain} notificações na blockchain`);

        if (totalOnChain > 0n) {
          let imported = 0;

          for (let i = 1n; i <= totalOnChain; i++) {
            try {
              const notification = await contract.getNotification(i);
              const [, patientHash, deathTimestamp, notificationTimestamp, notifiedBy, institutionId] = notification;

              const deathDatetime = new Date(Number(deathTimestamp) * 1000).toISOString();
              const notifDatetime = new Date(Number(notificationTimestamp) * 1000).toISOString();
              const localInstId = Number(institutionId);

              // Criar instituição se não existir
              const instExists = db.prepare('SELECT id FROM institutions WHERE id = ?').get(localInstId);
              if (!instExists) {
                db.prepare('INSERT INTO institutions (id, name, cnes, type, active) VALUES (?, ?, ?, ?, 1)')
                  .run(localInstId, `Instituição #${localInstId}`, `000000${localInstId}`, 'hospital');
              }

              // Inserir notificação
              db.prepare(`
                INSERT INTO death_notifications (
                  patient_hash, patient_name, death_datetime, notification_datetime,
                  cornea_viable, notified_by_user_id, institution_id,
                  source, is_automatic, blockchain_notification_id, blockchain_confirmed,
                  notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                patientHash,
                `Paciente Blockchain #${i}`,
                deathDatetime,
                notifDatetime,
                0, 1, localInstId,
                'api', 1, Number(i), 1,
                `Importado da blockchain. Notifier: ${notifiedBy}`
              );

              imported++;
            } catch (err) {
              // Ignorar erros individuais
            }
          }

          console.log(`   ✅ ${imported} notificações importadas da blockchain\n`);
        } else {
          console.log('   ℹ️  Nenhuma notificação na blockchain ainda\n');
        }
      } catch (err) {
        console.log(`   ⚠️  Não foi possível conectar à blockchain: ${err.message}`);
        console.log('   ℹ️  O sistema funcionará sem dados históricos da blockchain\n');
      }
    } else {
      console.log('⏭️  Passo 4/4: Sincronização blockchain ignorada (--skip-blockchain)\n');
    }

    // 5. Dados mock (opcional)
    if (withMockData) {
      console.log('🎭 Passo extra: Gerando dados de demonstração...');
      await new Promise(resolve => setTimeout(resolve, 500));
      require('./sync-mv-data');
      console.log('');
    }

    // Resumo final
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✅ Setup concluído com sucesso!                         ║
║                                                           ║
║   Para iniciar o servidor:                                ║
║   $ npm start                                             ║
║                                                           ║
║   Credenciais de acesso:                                  ║
║   📧 Email: admin@doechain.gov.br                         ║
║   🔑 Senha: admin123456                                   ║
║                                                           ║
║   Acesse: http://localhost:3001                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

  } catch (error) {
    console.error('\n❌ Erro durante o setup:', error.message);
    process.exit(1);
  }
}

// Executar
setup();

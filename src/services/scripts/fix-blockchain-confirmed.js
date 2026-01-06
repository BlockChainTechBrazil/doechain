/**
 * Script para corrigir o campo blockchain_confirmed em registros existentes
 */

const { initDatabase, getDatabase, closeDatabase } = require('../config/database');

async function fixBlockchainConfirmed() {
  console.log('🔧 Inicializando banco de dados...');
  await initDatabase();

  console.log('🔧 Corrigindo campo blockchain_confirmed...');

  const db = getDatabase();

  const result = db.prepare(`
    UPDATE death_notifications 
    SET blockchain_confirmed = 1 
    WHERE blockchain_tx_hash IS NOT NULL 
      AND blockchain_tx_hash != ''
  `).run();

  console.log(`✅ Registros atualizados: ${result.changes}`);

  // Verificar estatísticas atualizadas
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN blockchain_confirmed = 1 THEN 1 ELSE 0 END) as na_blockchain
    FROM death_notifications
  `).get();

  console.log(`📊 Total de notificações: ${stats.total}`);
  console.log(`⛓️  Na blockchain: ${stats.na_blockchain}`);

  // Fechar banco para salvar alterações
  closeDatabase();
}

// Executar
fixBlockchainConfirmed()
  .then(() => {
    console.log('\n✅ Correção concluída! Reinicie o servidor para ver as alterações.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  });

/**
 * Script para sincronizar status de transações pendentes com a blockchain
 */

const { ethers } = require('ethers');
const { initDatabase, getDatabase, closeDatabase } = require('../config/database');

async function syncTransactionStatus() {
  console.log('🔄 Sincronizando status de transações...\n');

  await initDatabase();
  const db = getDatabase();

  // Buscar transações pendentes
  const pendingTxs = db.prepare(`
    SELECT id, tx_hash, tx_type FROM blockchain_transactions 
    WHERE status = 'pending' AND tx_hash IS NOT NULL AND tx_hash != ''
  `).all();

  if (pendingTxs.length === 0) {
    console.log('✅ Nenhuma transação pendente para sincronizar.');
    closeDatabase();
    return;
  }

  console.log(`📋 Encontradas ${pendingTxs.length} transações pendentes\n`);

  // Configurar provider (URL hardcoded)
  const rpcUrl = 'https://ethereum-sepolia-rpc.publicnode.com';
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  let updated = 0;
  let failed = 0;

  for (const tx of pendingTxs) {
    try {
      console.log(`🔍 Verificando TX: ${tx.tx_hash.substring(0, 20)}...`);

      const receipt = await provider.getTransactionReceipt(tx.tx_hash);

      if (receipt) {
        // Transação confirmada
        db.prepare(`
          UPDATE blockchain_transactions 
          SET status = 'confirmed', 
              block_number = ?, 
              gas_used = ?,
              confirmed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(receipt.blockNumber, receipt.gasUsed.toString(), tx.id);

        console.log(`   ✅ Confirmada no bloco ${receipt.blockNumber}`);
        updated++;
      } else {
        console.log(`   ⏳ Ainda pendente na blockchain`);
      }
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Resultado:`);
  console.log(`   - Atualizadas: ${updated}`);
  console.log(`   - Ainda pendentes: ${pendingTxs.length - updated - failed}`);
  console.log(`   - Erros: ${failed}`);

  closeDatabase();
}

syncTransactionStatus()
  .then(() => {
    console.log('\n✅ Sincronização concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  });

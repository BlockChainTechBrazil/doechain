/**
 * RelayerService - Gerencia transações gasless na blockchain
 * Baseado no PetID, adaptado para Node.js
 */

const { ethers } = require('ethers');
const forwarderABI = require('../abi/forwarderABI.json');
const { currentNetwork } = require('../config/networks');
const contracts = require('../config/contracts');
const { getDatabase } = require('../config/database');

class RelayerService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(currentNetwork.rpcUrl);

    const privateKey = process.env.RELAYER_PRIVATE_KEY;

    // Verificar se é uma chave válida (64 caracteres hex)
    const isValidKey = privateKey &&
      privateKey.length >= 64 &&
      !privateKey.includes('sua_chave') &&
      /^(0x)?[a-fA-F0-9]{64}$/.test(privateKey.replace('0x', ''));

    if (!isValidKey) {
      console.warn('⚠️  RELAYER_PRIVATE_KEY não configurada ou inválida!');
      console.warn('   O sistema funcionará sem suporte a transações gasless.');
      this.wallet = null;
      this.forwarder = null;
    } else {
      try {
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.forwarder = new ethers.Contract(
          contracts.forwarder,
          forwarderABI,
          this.wallet
        );
        console.log(`🔐 Relayer carregado: ${this.wallet.address}`);
      } catch (err) {
        console.error('❌ Erro ao carregar relayer:', err.message);
        this.wallet = null;
        this.forwarder = null;
      }
    }
  }

  /**
   * Verifica se o relayer está configurado
   */
  isConfigured() {
    return this.wallet !== null && this.forwarder !== null;
  }

  /**
   * Obtém o endereço da carteira relayer
   */
  getAddress() {
    return this.wallet?.address || null;
  }

  /**
   * Obtém o saldo da carteira relayer
   */
  async getBalance() {
    if (!this.wallet) return { wei: '0', eth: '0' };

    const balance = await this.provider.getBalance(this.wallet.address);
    return {
      wei: balance.toString(),
      eth: ethers.formatEther(balance)
    };
  }

  /**
   * Registra o saldo atual no histórico
   */
  async recordBalance(reason = 'check') {
    const db = getDatabase();
    const balance = await this.getBalance();

    const stmt = db.prepare(`
      INSERT INTO relayer_balance_history (balance_wei, balance_eth, change_reason)
      VALUES (?, ?, ?)
    `);
    stmt.run(balance.wei, balance.eth, reason);

    return balance;
  }

  /**
   * Verifica se há saldo suficiente para transação
   */
  async hasEnoughBalance(estimatedGas = 300000) {
    const balance = await this.getBalance();
    const gasPrice = await this.provider.getFeeData();
    const estimatedCost = BigInt(estimatedGas) * (gasPrice.gasPrice || BigInt(20000000000));

    return BigInt(balance.wei) > estimatedCost;
  }

  /**
   * Retransmite uma transação assinada (meta-transaction)
   * @param {Object} request - Objeto da requisição EIP-712
   * @param {string} signature - Assinatura do usuário
   * @returns {Object} - Resultado da transação
   */
  async relayTransaction(request, signature) {
    if (!this.isConfigured()) {
      throw new Error('Relayer não configurado');
    }

    // Verificar saldo
    const hasBalance = await this.hasEnoughBalance();
    if (!hasBalance) {
      throw new Error('Saldo insuficiente no relayer para pagar gas');
    }

    // Verificar assinatura
    const valid = await this.forwarder.verify(request, signature);
    if (!valid) {
      throw new Error('Assinatura inválida');
    }

    console.log(`📤 Retransmitindo transação de: ${request.from}`);

    const db = getDatabase();

    // Registrar transação pendente
    const insertStmt = db.prepare(`
      INSERT INTO blockchain_transactions (tx_type, from_address, to_address, status)
      VALUES ('relay', ?, ?, 'pending')
    `);
    const txRecord = insertStmt.run(request.from, request.to);
    const recordId = txRecord.lastInsertRowid;

    try {
      // Executar transação
      const tx = await this.forwarder.execute(request, signature);

      console.log(`📝 TX enviada: ${tx.hash}`);

      // Atualizar registro com hash
      db.prepare(`
        UPDATE blockchain_transactions 
        SET tx_hash = ? 
        WHERE id = ?
      `).run(tx.hash, recordId);

      // Aguardar confirmação (em background)
      this.waitForConfirmation(tx.hash, recordId);

      return {
        success: true,
        txHash: tx.hash,
        recordId
      };

    } catch (error) {
      // Registrar erro
      db.prepare(`
        UPDATE blockchain_transactions 
        SET status = 'failed', error_message = ? 
        WHERE id = ?
      `).run(error.message, recordId);

      throw error;
    }
  }

  /**
   * Aguarda confirmação da transação em background
   */
  async waitForConfirmation(txHash, recordId) {
    try {
      const db = getDatabase();
      const receipt = await this.provider.waitForTransaction(txHash, 1, 60000);

      if (receipt) {
        db.prepare(`
          UPDATE blockchain_transactions 
          SET status = 'confirmed', 
              block_number = ?, 
              gas_used = ?,
              confirmed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(receipt.blockNumber, receipt.gasUsed.toString(), recordId);

        // Registrar novo saldo
        await this.recordBalance(`tx_confirmed_${txHash}`);

        console.log(`✅ TX confirmada: ${txHash} (bloco ${receipt.blockNumber})`);
      }
    } catch (error) {
      console.error(`❌ Erro aguardando confirmação: ${error.message}`);
    }
  }

  /**
   * Obtém histórico de transações
   */
  getTransactionHistory(limit = 50) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM blockchain_transactions 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  /**
   * Obtém histórico de saldo
   */
  getBalanceHistory(limit = 30) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM relayer_balance_history 
      ORDER BY recorded_at DESC 
      LIMIT ?
    `);
    return stmt.all(limit);
  }
}

// Singleton
const relayerService = new RelayerService();

module.exports = relayerService;

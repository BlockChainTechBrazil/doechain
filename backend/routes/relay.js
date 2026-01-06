/**
 * Rotas do Relayer (blockchain)
 */

const express = require('express');
const relayerService = require('../services/RelayerService');
const { authenticate, adminOnly, healthOperators } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/relay/status
 * Status do relayer
 */
router.get('/status', authenticate, adminOnly, async (req, res) => {
  try {
    const configured = relayerService.isConfigured();
    const balance = await relayerService.getBalance();
    const address = relayerService.getAddress();

    res.json({
      configured,
      address,
      balance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/relay/balance
 * Saldo atual do relayer
 */
router.get('/balance', authenticate, adminOnly, async (req, res) => {
  try {
    const balance = await relayerService.getBalance();
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/relay/record-balance
 * Registra saldo atual no histórico
 */
router.post('/record-balance', authenticate, adminOnly, async (req, res) => {
  try {
    const balance = await relayerService.recordBalance('manual_check');
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/relay/balance-history
 * Histórico de saldo
 */
router.get('/balance-history', authenticate, adminOnly, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const history = relayerService.getBalanceHistory(limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/relay/transactions
 * Histórico de transações
 */
router.get('/transactions', authenticate, adminOnly, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const transactions = relayerService.getTransactionHistory(limit);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/relay/transaction
 * Relayer uma transação (meta-transaction)
 */
router.post('/transaction', authenticate, healthOperators, async (req, res) => {
  try {
    const { request, signature } = req.body;

    if (!request || !signature) {
      return res.status(400).json({ error: 'Request e signature obrigatórios' });
    }

    const result = await relayerService.relayTransaction(request, signature);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/relay/check-balance
 * Verifica se há saldo suficiente
 */
router.get('/check-balance', authenticate, async (req, res) => {
  try {
    const estimatedGas = parseInt(req.query.gas) || 300000;
    const hasEnough = await relayerService.hasEnoughBalance(estimatedGas);
    const balance = await relayerService.getBalance();

    res.json({
      hasEnoughBalance: hasEnough,
      currentBalance: balance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

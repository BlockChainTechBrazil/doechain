/**
 * MV Integration Routes - Rotas para integração com API MV (Mock)
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const mvMockService = require('../services/MVMockService');
const notificationService = require('../services/NotificationService');

/**
 * GET /api/mv/status
 * Retorna status do serviço MV Mock
 */
router.get('/status', authenticate, (req, res) => {
  try {
    const status = mvMockService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mv/toggle
 * Ativa/Desativa o polling da API MV
 */
router.post('/toggle', authenticate, authorize('admin'), (req, res) => {
  try {
    const { active } = req.body;
    const newStatus = mvMockService.setActive(active);
    res.json({
      active: newStatus,
      message: newStatus ? 'Integração MV ativada' : 'Integração MV desativada'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mv/poll
 * Busca novos óbitos da API MV (polling)
 * Salva automaticamente no banco e envia para blockchain
 */
router.get('/poll', authenticate, async (req, res) => {
  try {
    const newDeaths = mvMockService.fetchNewDeaths();

    if (newDeaths.length === 0) {
      return res.json({
        count: 0,
        notifications: [],
        message: 'Nenhum novo óbito encontrado'
      });
    }

    // Processar cada óbito e criar notificação
    const createdNotifications = [];

    for (const death of newDeaths) {
      try {
        // Criar notificação automática
        const notification = await notificationService.createAutomaticNotification(death, req.user.id);
        createdNotifications.push(notification);

        console.log(`[MV] Notificação automática criada: #${notification.id} - ${death.mv_id}`);

        // Tentar enviar para blockchain automaticamente
        try {
          await notificationService.registerOnBlockchain(notification.id, req.user.id);
          console.log(`[MV] Notificação #${notification.id} enviada para blockchain`);
        } catch (blockchainError) {
          console.warn(`[MV] Erro ao enviar para blockchain: ${blockchainError.message}`);
          // Continua mesmo se falhar o blockchain
        }
      } catch (createError) {
        console.error(`[MV] Erro ao criar notificação: ${createError.message}`);
      }
    }

    res.json({
      count: createdNotifications.length,
      notifications: createdNotifications,
      message: `${createdNotifications.length} notificação(ões) criada(s) automaticamente`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mv/deaths
 * Lista todos os óbitos do mock (para debug/visualização)
 */
router.get('/deaths', authenticate, authorize('admin'), (req, res) => {
  try {
    const { hours } = req.query;

    if (hours) {
      const deaths = mvMockService.getRecentDeaths(parseInt(hours));
      return res.json(deaths);
    }

    const deaths = mvMockService.getAllDeaths();
    res.json(deaths);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mv/force-generate
 * Força geração de um novo óbito (para testes)
 */
router.post('/force-generate', authenticate, authorize('admin'), async (req, res) => {
  try {
    const death = mvMockService.forceGenerateDeath();

    // Criar notificação automaticamente
    const notification = await notificationService.createAutomaticNotification(death, req.user.id);

    // Tentar enviar para blockchain
    try {
      await notificationService.registerOnBlockchain(notification.id, req.user.id);
    } catch (blockchainError) {
      console.warn(`[MV] Erro ao enviar para blockchain: ${blockchainError.message}`);
    }

    res.json({
      death,
      notification,
      message: 'Óbito gerado e notificação criada'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mv/death/:mvId
 * Busca óbito específico por ID MV
 */
router.get('/death/:mvId', authenticate, (req, res) => {
  try {
    const death = mvMockService.getDeathByMvId(req.params.mvId);

    if (!death) {
      return res.status(404).json({ error: 'Óbito não encontrado' });
    }

    res.json(death);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

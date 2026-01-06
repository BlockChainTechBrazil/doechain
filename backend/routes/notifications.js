/**
 * Rotas de Notificação de Óbitos
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const notificationService = require('../services/NotificationService');
const { authenticate, canNotify, canManageCornea, healthOperators } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/notifications
 * Criar nova notificação de óbito
 */
router.post('/', authenticate, canNotify, [
  body('patientName').notEmpty().withMessage('Nome do paciente obrigatório'),
  body('patientCPF').notEmpty().withMessage('CPF obrigatório'),
  body('deathDatetime').isISO8601().withMessage('Data/hora do óbito inválida'),
  body('institutionId').isInt().withMessage('Instituição obrigatória')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const notification = await notificationService.createNotification(req.body, req.user.id);
    res.status(201).json(notification);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/notifications
 * Listar notificações
 */
router.get('/', authenticate, healthOperators, (req, res) => {
  try {
    const { status, institutionId, corneaViable, startDate, endDate, limit } = req.query;

    // Se não for admin/ses, limitar à própria instituição
    let filters = {
      status,
      corneaViable: corneaViable !== undefined ? corneaViable === 'true' : undefined,
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : 100
    };

    if (!['admin', 'ses', 'banco_olhos'].includes(req.user.role)) {
      filters.institutionId = req.user.institutionId;
    } else if (institutionId) {
      filters.institutionId = parseInt(institutionId);
    }

    const notifications = notificationService.listNotifications(filters);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notifications/statistics
 * Estatísticas
 */
router.get('/statistics', authenticate, healthOperators, (req, res) => {
  try {
    let institutionId = null;

    // Se não for admin/ses, limitar à própria instituição
    if (!['admin', 'ses'].includes(req.user.role)) {
      institutionId = req.user.institutionId;
    } else if (req.query.institutionId) {
      institutionId = parseInt(req.query.institutionId);
    }

    const stats = notificationService.getStatistics(institutionId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notifications/:id
 * Buscar notificação por ID
 */
router.get('/:id', authenticate, healthOperators, (req, res) => {
  try {
    const notification = notificationService.getNotificationById(parseInt(req.params.id));

    if (!notification) {
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }

    // Verificar permissão
    if (!['admin', 'ses', 'banco_olhos'].includes(req.user.role) &&
      notification.institution_id !== req.user.institutionId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/notifications/:id/cornea
 * Atualizar status de córnea
 */
router.put('/:id/cornea', authenticate, canManageCornea, [
  body('leftStatus').isIn(['not_evaluated', 'viable', 'not_viable', 'collected', 'transplanted']),
  body('rightStatus').isIn(['not_evaluated', 'viable', 'not_viable', 'collected', 'transplanted'])
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { leftStatus, rightStatus } = req.body;
    const notification = notificationService.updateCorneaStatus(
      parseInt(req.params.id),
      leftStatus,
      rightStatus,
      req.user.id
    );

    res.json(notification);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/notifications/:id/consent
 * Registrar consentimento familiar
 */
router.put('/:id/consent', authenticate, canNotify, [
  body('consent').isBoolean().withMessage('Consentimento deve ser true/false'),
  body('consentBy').notEmpty().withMessage('Responsável pelo consentimento obrigatório')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { consent, consentBy } = req.body;
    const notification = notificationService.registerConsent(
      parseInt(req.params.id),
      consent,
      consentBy,
      req.user.id
    );

    res.json(notification);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/:id/blockchain
 * Submeter para blockchain
 */
router.post('/:id/blockchain', authenticate, canNotify, async (req, res) => {
  try {
    const notification = await notificationService.registerOnBlockchain(
      parseInt(req.params.id),
      req.user.id
    );

    res.json(notification);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

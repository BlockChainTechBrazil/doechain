/**
 * Rotas de Instituições
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const institutionService = require('../services/InstitutionService');
const { authenticate, adminOnly, healthOperators } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/institutions
 * Criar instituição (apenas admin)
 */
router.post('/', authenticate, adminOnly, [
  body('name').notEmpty().withMessage('Nome obrigatório'),
  body('type').isIn(['hospital', 'iml', 'svo', 'banco_olhos', 'ses']).withMessage('Tipo inválido')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const institution = institutionService.create(req.body, req.user.id);
    res.status(201).json(institution);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/institutions
 * Listar instituições
 */
router.get('/', authenticate, healthOperators, (req, res) => {
  try {
    const { type, active, city } = req.query;
    const institutions = institutionService.list({
      type,
      active: active !== undefined ? active === 'true' : undefined,
      city
    });
    res.json(institutions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/institutions/types
 * Listar tipos disponíveis
 */
router.get('/types', authenticate, (req, res) => {
  res.json([
    { value: 'hospital', label: 'Hospital' },
    { value: 'iml', label: 'IML - Instituto Médico Legal' },
    { value: 'svo', label: 'SVO - Serviço de Verificação de Óbito' },
    { value: 'banco_olhos', label: 'Banco de Olhos' },
    { value: 'ses', label: 'SES - Secretaria Estadual de Saúde' }
  ]);
});

/**
 * GET /api/institutions/stats
 * Estatísticas por tipo
 */
router.get('/stats', authenticate, adminOnly, (req, res) => {
  try {
    const stats = institutionService.getCountByType();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/institutions/:id
 * Buscar por ID
 */
router.get('/:id', authenticate, healthOperators, (req, res) => {
  try {
    const institution = institutionService.getById(parseInt(req.params.id));
    if (!institution) {
      return res.status(404).json({ error: 'Instituição não encontrada' });
    }
    res.json(institution);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/institutions/:id
 * Atualizar (apenas admin)
 */
router.put('/:id', authenticate, adminOnly, (req, res) => {
  try {
    const institution = institutionService.update(
      parseInt(req.params.id),
      req.body,
      req.user.id
    );
    res.json(institution);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

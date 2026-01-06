/**
 * Rotas de Autenticação
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const authService = require('../services/AuthService');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Login de usuário
 */
router.post('/login', [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Senha obrigatória')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const result = await authService.login(email, password);

    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

/**
 * POST /api/auth/logout
 * Logout - revoga token
 */
router.post('/logout', authenticate, (req, res) => {
  try {
    authService.logout(req.token);
    res.json({ message: 'Logout realizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/me
 * Retorna usuário atual
 */
router.get('/me', authenticate, (req, res) => {
  try {
    const user = authService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/auth/password
 * Alterar senha
 */
router.put('/password', authenticate, [
  body('oldPassword').notEmpty().withMessage('Senha atual obrigatória'),
  body('newPassword').isLength({ min: 8 }).withMessage('Nova senha deve ter no mínimo 8 caracteres')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { oldPassword, newPassword } = req.body;
    await authService.changePassword(req.user.id, oldPassword, newPassword);

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/auth/users
 * Criar usuário (apenas admin)
 */
router.post('/users', authenticate, adminOnly, [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 8 }).withMessage('Senha deve ter no mínimo 8 caracteres'),
  body('name').notEmpty().withMessage('Nome obrigatório'),
  body('role').isIn(['admin', 'hospital', 'iml', 'svo', 'banco_olhos', 'ses']).withMessage('Role inválida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await authService.createUser(req.body, req.user.id);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/auth/users
 * Listar usuários (apenas admin)
 */
router.get('/users', authenticate, adminOnly, (req, res) => {
  try {
    const { role, active, institutionId } = req.query;
    const users = authService.listUsers({
      role,
      active: active !== undefined ? active === 'true' : undefined,
      institutionId: institutionId ? parseInt(institutionId) : undefined
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/users/:id
 * Buscar usuário por ID (apenas admin)
 */
router.get('/users/:id', authenticate, adminOnly, (req, res) => {
  try {
    const user = authService.getUserById(parseInt(req.params.id));
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/auth/users/:id
 * Atualizar usuário (apenas admin)
 */
router.put('/users/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const user = await authService.updateUser(parseInt(req.params.id), req.body, req.user.id);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

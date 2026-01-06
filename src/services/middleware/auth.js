/**
 * Middleware de autenticação JWT
 */

const authService = require('../services/AuthService');

/**
 * Verifica se o usuário está autenticado
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.substring(7);
    const decoded = authService.verifyToken(token);

    req.user = decoded;
    req.token = token;

    next();
  } catch (error) {
    return res.status(401).json({ error: error.message || 'Token inválido' });
  }
};

/**
 * Verifica se o usuário tem uma das roles permitidas
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado. Permissão insuficiente.' });
    }

    next();
  };
};

/**
 * Apenas admin
 */
const adminOnly = authorize('admin');

/**
 * Admin ou operadores de saúde
 */
const healthOperators = authorize('admin', 'hospital', 'iml', 'svo', 'banco_olhos', 'ses');

/**
 * Quem pode notificar óbitos
 */
const canNotify = authorize('admin', 'hospital', 'iml', 'svo');

/**
 * Quem pode ver/atualizar córneas
 */
const canManageCornea = authorize('admin', 'banco_olhos', 'ses');

module.exports = {
  authenticate,
  authorize,
  adminOnly,
  healthOperators,
  canNotify,
  canManageCornea
};

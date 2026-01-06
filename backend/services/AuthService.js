/**
 * AuthService - Gerencia autenticação e autorização
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDatabase } = require('../config/database');

class AuthService {
  /**
   * Autentica um usuário
   */
  async login(email, password) {
    const db = getDatabase();
    const user = db.prepare(`
      SELECT id, email, password_hash, name, role, institution_id, active 
      FROM users 
      WHERE email = ?
    `).get(email);

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    if (!user.active) {
      throw new Error('Usuário desativado');
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new Error('Senha incorreta');
    }

    // Atualizar último login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Gerar token JWT
    const token = this.generateToken(user);

    // Salvar sessão
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    db.prepare(`
      INSERT INTO sessions (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `).run(user.id, tokenHash, expiresAt.toISOString());

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        institutionId: user.institution_id
      }
    };
  }

  /**
   * Gera token JWT
   */
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        institutionId: user.institution_id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
  }

  /**
   * Verifica token JWT
   */
  verifyToken(token) {
    try {
      const db = getDatabase();
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Verificar se sessão não foi revogada
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const session = db.prepare(`
        SELECT id FROM sessions 
        WHERE token_hash = ? AND revoked = 0 AND expires_at > datetime('now')
      `).get(tokenHash);

      if (!session) {
        throw new Error('Sessão inválida ou expirada');
      }

      return decoded;
    } catch (error) {
      throw new Error('Token inválido');
    }
  }

  /**
   * Logout - revoga token
   */
  logout(token) {
    const db = getDatabase();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    db.prepare('UPDATE sessions SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
  }

  /**
   * Cria novo usuário (apenas admin)
   */
  async createUser(userData, createdByUserId) {
    const db = getDatabase();
    const { email, password, name, role, institutionId } = userData;

    // Verificar se email já existe
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      throw new Error('Email já cadastrado');
    }

    // Hash da senha
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Inserir usuário
    const stmt = db.prepare(`
      INSERT INTO users (email, password_hash, name, role, institution_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(email, passwordHash, name, role, institutionId || null);

    // Log de auditoria
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, 'create_user', 'user', ?, ?)
    `).run(createdByUserId, result.lastInsertRowid, JSON.stringify({ email, name, role }));

    return {
      id: result.lastInsertRowid,
      email,
      name,
      role
    };
  }

  /**
   * Atualiza usuário
   */
  async updateUser(userId, userData, updatedByUserId) {
    const db = getDatabase();
    const { name, role, institutionId, active } = userData;

    // Buscar dados antigos
    const oldUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!oldUser) {
      throw new Error('Usuário não encontrado');
    }

    // Atualizar
    db.prepare(`
      UPDATE users 
      SET name = COALESCE(?, name),
          role = COALESCE(?, role),
          institution_id = COALESCE(?, institution_id),
          active = COALESCE(?, active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, role, institutionId, active, userId);

    // Log de auditoria
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (?, 'update_user', 'user', ?, ?, ?)
    `).run(updatedByUserId, userId, JSON.stringify(oldUser), JSON.stringify(userData));

    return this.getUserById(userId);
  }

  /**
   * Altera senha
   */
  async changePassword(userId, oldPassword, newPassword) {
    const db = getDatabase();
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const validOld = await bcrypt.compare(oldPassword, user.password_hash);
    if (!validOld) {
      throw new Error('Senha atual incorreta');
    }

    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(newPassword, salt);

    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newHash, userId);

    // Revogar todas as sessões antigas
    db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(userId);
  }

  /**
   * Busca usuário por ID
   */
  getUserById(userId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT id, email, name, role, institution_id, active, created_at, last_login
      FROM users WHERE id = ?
    `).get(userId);
  }

  /**
   * Lista todos os usuários
   */
  listUsers(filters = {}) {
    const db = getDatabase();
    let query = `
      SELECT u.id, u.email, u.name, u.role, u.active, u.created_at, u.last_login,
             i.name as institution_name
      FROM users u
      LEFT JOIN institutions i ON u.institution_id = i.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.role) {
      query += ' AND u.role = ?';
      params.push(filters.role);
    }

    if (filters.active !== undefined) {
      query += ' AND u.active = ?';
      params.push(filters.active ? 1 : 0);
    }

    if (filters.institutionId) {
      query += ' AND u.institution_id = ?';
      params.push(filters.institutionId);
    }

    query += ' ORDER BY u.created_at DESC';

    return db.prepare(query).all(...params);
  }
}

module.exports = new AuthService();

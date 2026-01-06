/**
 * InstitutionService - Gerencia instituições (hospitais, IML, SVO, etc)
 */

const { getDatabase } = require('../config/database');

class InstitutionService {
  /**
   * Cria nova instituição
   */
  create(data, createdByUserId) {
    const db = getDatabase();
    const { name, type, cnes, address, city, state, phone, email } = data;

    // Verificar CNES duplicado
    if (cnes) {
      const existing = db.prepare('SELECT id FROM institutions WHERE cnes = ?').get(cnes);
      if (existing) {
        throw new Error('CNES já cadastrado');
      }
    }

    const stmt = db.prepare(`
      INSERT INTO institutions (name, type, cnes, address, city, state, phone, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(name, type, cnes, address, city, state || 'GO', phone, email);

    // Log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (?, 'create_institution', 'institution', ?, ?)
    `).run(createdByUserId, result.lastInsertRowid, JSON.stringify({ name, type, cnes }));

    return this.getById(result.lastInsertRowid);
  }

  /**
   * Atualiza instituição
   */
  update(id, data, updatedByUserId) {
    const db = getDatabase();
    const old = this.getById(id);
    if (!old) {
      throw new Error('Instituição não encontrada');
    }

    const { name, cnes, address, city, state, phone, email, active } = data;

    db.prepare(`
      UPDATE institutions 
      SET name = COALESCE(?, name),
          cnes = COALESCE(?, cnes),
          address = COALESCE(?, address),
          city = COALESCE(?, city),
          state = COALESCE(?, state),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          active = COALESCE(?, active)
      WHERE id = ?
    `).run(name, cnes, address, city, state, phone, email, active, id);

    // Log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (?, 'update_institution', 'institution', ?, ?, ?)
    `).run(updatedByUserId, id, JSON.stringify(old), JSON.stringify(data));

    return this.getById(id);
  }

  /**
   * Busca por ID
   */
  getById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM institutions WHERE id = ?').get(id);
  }

  /**
   * Lista instituições
   */
  list(filters = {}) {
    const db = getDatabase();
    let query = 'SELECT * FROM institutions WHERE 1=1';
    const params = [];

    if (filters.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }

    if (filters.active !== undefined) {
      query += ' AND active = ?';
      params.push(filters.active ? 1 : 0);
    }

    if (filters.city) {
      query += ' AND city = ?';
      params.push(filters.city);
    }

    query += ' ORDER BY name';

    return db.prepare(query).all(...params);
  }

  /**
   * Lista por tipo
   */
  listByType(type) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM institutions WHERE type = ? AND active = 1 ORDER BY name')
      .all(type);
  }

  /**
   * Estatísticas por tipo
   */
  getCountByType() {
    const db = getDatabase();
    return db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM institutions 
      WHERE active = 1 
      GROUP BY type
    `).all();
  }
}

module.exports = new InstitutionService();

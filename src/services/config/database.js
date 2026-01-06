/**
 * Database configuration using sql.js (pure JavaScript SQLite)
 * Compatible wrapper for better-sqlite3 API
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Caminho do banco de dados (na raiz do projeto)
const dbPath = path.join(__dirname, '..', '..', '..', 'data', 'doechain.db');
const dataDir = path.join(__dirname, '..', '..', '..', 'data');

// Garantir que o diretório data existe
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;
let SQL = null;

/**
 * Wrapper para compatibilidade com better-sqlite3 API
 */
class DatabaseWrapper {
  constructor(sqlDb) {
    this._db = sqlDb;
    this._saveInterval = null;
    this._dirty = false;

    // Auto-save a cada 5 segundos se houver mudanças
    this._saveInterval = setInterval(() => {
      if (this._dirty) {
        this._save();
        this._dirty = false;
      }
    }, 5000);
  }

  _save() {
    try {
      const data = this._db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    } catch (err) {
      console.error('[DB] Erro ao salvar banco:', err);
    }
  }

  /**
   * Executa SQL e retorna resultado
   */
  exec(sql) {
    try {
      this._db.run(sql);
      this._dirty = true;
    } catch (err) {
      console.error('[DB] Erro exec:', err);
      throw err;
    }
  }

  /**
   * Prepara uma statement
   */
  prepare(sql) {
    const self = this;
    return {
      _sql: sql,

      run(...params) {
        try {
          self._db.run(sql, params);
          self._dirty = true;
          return {
            changes: self._db.getRowsModified(),
            lastInsertRowid: self._getLastInsertRowId()
          };
        } catch (err) {
          console.error('[DB] Erro run:', sql, params, err);
          throw err;
        }
      },

      get(...params) {
        try {
          const stmt = self._db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        } catch (err) {
          console.error('[DB] Erro get:', sql, params, err);
          throw err;
        }
      },

      all(...params) {
        try {
          const results = [];
          const stmt = self._db.prepare(sql);
          stmt.bind(params);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        } catch (err) {
          console.error('[DB] Erro all:', sql, params, err);
          throw err;
        }
      }
    };
  }

  _getLastInsertRowId() {
    try {
      const stmt = this._db.prepare('SELECT last_insert_rowid() as id');
      if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result.id;
      }
      stmt.free();
      return 0;
    } catch (err) {
      return 0;
    }
  }

  /**
   * Pragma support
   */
  pragma(pragma) {
    try {
      this._db.run(`PRAGMA ${pragma}`);
    } catch (err) {
      // Ignorar erros de pragma
    }
  }

  /**
   * Fechar conexão
   */
  close() {
    if (this._saveInterval) {
      clearInterval(this._saveInterval);
    }
    this._save();
    this._db.close();
  }

  /**
   * Transaction support
   */
  transaction(fn) {
    return (...args) => {
      this._db.run('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        this._db.run('COMMIT');
        this._dirty = true;
        return result;
      } catch (err) {
        this._db.run('ROLLBACK');
        throw err;
      }
    };
  }
}

/**
 * Inicializa o banco de dados
 */
async function initDatabase() {
  if (db) return db;

  try {
    SQL = await initSqlJs();

    // Verificar se existe arquivo do banco
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new DatabaseWrapper(new SQL.Database(fileBuffer));
      console.log('[DB] Banco de dados carregado:', dbPath);
    } else {
      db = new DatabaseWrapper(new SQL.Database());
      console.log('[DB] Novo banco de dados criado');
    }

    // Habilitar foreign keys
    db.pragma('foreign_keys = ON');

    return db;
  } catch (err) {
    console.error('[DB] Erro ao inicializar banco:', err);
    throw err;
  }
}

/**
 * Obtém instância do banco (síncrono, para compatibilidade)
 * IMPORTANTE: initDatabase() deve ser chamado antes
 */
function getDatabase() {
  // Se estiver rodando como standalone, usar o global
  if (global.getDatabase && typeof global.getDatabase === 'function' && global.getDatabase !== getDatabase) {
    return global.getDatabase();
  }

  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Fecha o banco de dados
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { initDatabase, getDatabase, closeDatabase };

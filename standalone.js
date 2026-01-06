/**
 * DoeChain - Standalone Executable
 * Este arquivo é o ponto de entrada para o executável empacotado
 * Todas as configurações estão embutidas no código
 */

const path = require('path');
const fs = require('fs');

// Detectar se está rodando como executável empacotado
const isPkg = typeof process.pkg !== 'undefined';

// Diretório base - se empacotado, usa o diretório do executável
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;
const servicesDir = isPkg ? path.join(baseDir) : path.join(__dirname, 'src', 'services');
const pagesDir = isPkg ? path.join(baseDir, 'src', 'pages') : path.join(__dirname, 'src', 'pages');
const dataDir = path.join(baseDir, 'data');

// Garantir que o diretório data existe
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ========================================
// CONFIGURAÇÕES EMBUTIDAS (sem .env)
// ========================================
const CONFIG = {
  PORT: 3001,
  NODE_ENV: 'production',
  JWT_SECRET: 'doechain_jwt_secret_hospital_ses_go_2026',
  JWT_EXPIRES_IN: '24h',
  RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
  CHAIN_ID: 11155111,
  RELAYER_PRIVATE_KEY: '0x4c2a27080a075b1179788fb491ec041809c22d8e0705241827ad7c23c74a4f9d',
  FORWARDER_ADDRESS: '0x1Bf44d835d9695c36B0640A5B06f356fe52694B5',
  DEATH_NOTIFICATION_ADDRESS: '0x690fD2Ee2BAdD99C543b89eEAB9C73C1d8F94E54',
  ADMIN_EMAIL: 'admin@doechain.gov.br',
  ADMIN_PASSWORD: 'admin123456',
  ADMIN_NAME: 'Administrador Sistema'
};

// Definir variáveis de ambiente a partir das configurações embutidas
Object.keys(CONFIG).forEach(key => {
  process.env[key] = CONFIG[key];
});

// Configurar caminhos para o pkg
process.env.DOECHAIN_BASE_DIR = baseDir;
process.env.DOECHAIN_DATA_DIR = dataDir;
process.env.DOECHAIN_PAGES_DIR = pagesDir;
process.env.DOECHAIN_IS_PKG = isPkg ? 'true' : 'false';

// ========================================
// Importações do Backend
// ========================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Configurar sql.js para modo pkg
if (isPkg) {
  // Copiar sql-wasm.wasm se necessário
  const wasmSource = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const wasmDest = path.join(baseDir, 'sql-wasm.wasm');

  if (fs.existsSync(wasmSource) && !fs.existsSync(wasmDest)) {
    try {
      fs.copyFileSync(wasmSource, wasmDest);
    } catch (e) {
      // Ignorar se já existe ou não conseguir copiar
    }
  }
}

// Inicializar banco de dados customizado para standalone
const initSqlJs = require('sql.js');

let db = null;
let SQL = null;
const dbPath = path.join(dataDir, 'doechain.db');

class DatabaseWrapper {
  constructor(sqlDb) {
    this._db = sqlDb;
    this._saveInterval = null;
    this._dirty = false;

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

  exec(sql) {
    try {
      this._db.run(sql);
      this._dirty = true;
    } catch (err) {
      console.error('[DB] Erro exec:', err);
      throw err;
    }
  }

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
          const stmt = self._db.prepare(sql);
          stmt.bind(params);
          const results = [];
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

  close() {
    if (this._saveInterval) {
      clearInterval(this._saveInterval);
    }
    if (this._dirty) {
      this._save();
    }
    if (this._db) {
      this._db.close();
    }
  }
}

async function initDatabase() {
  if (db) return db;

  try {
    const locateFile = (file) => {
      if (isPkg) {
        const localPath = path.join(baseDir, file);
        if (fs.existsSync(localPath)) return localPath;
      }
      return path.join(__dirname, 'node_modules', 'sql.js', 'dist', file);
    };

    SQL = await initSqlJs({ locateFile });

    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new DatabaseWrapper(new SQL.Database(fileBuffer));
      console.log('[DB] Banco de dados carregado:', dbPath);
      // Executar migrações para bancos existentes
      await runMigrations();
    } else {
      db = new DatabaseWrapper(new SQL.Database());
      console.log('[DB] Novo banco de dados criado');
      await initializeTables();
    }

    return db;
  } catch (err) {
    console.error('[DB] Erro ao inicializar banco:', err);
    throw err;
  }
}

// Migrações para atualizar banco existente
async function runMigrations() {
  console.log('[DB] Verificando migrações...');

  // Adicionar coluna last_login se não existir
  try {
    db.exec(`ALTER TABLE users ADD COLUMN last_login DATETIME`);
    console.log('[DB] Coluna last_login adicionada');
  } catch (e) {
    // Coluna já existe, ignorar
  }

  // Criar tabela sessions se não existir (para autenticação JWT)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

async function initializeTables() {
  console.log('📦 Criando tabelas...');

  // Users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'hospital', 'iml', 'svo', 'banco_olhos', 'ses')),
      institution_id INTEGER,
      active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Institutions
  db.exec(`
    CREATE TABLE IF NOT EXISTS institutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('hospital', 'iml', 'svo', 'banco_olhos', 'ses')),
      cnes TEXT,
      city TEXT,
      state TEXT DEFAULT 'GO',
      phone TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Death Notifications
  db.exec(`
    CREATE TABLE IF NOT EXISTS death_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_hash TEXT NOT NULL,
      patient_age INTEGER,
      patient_gender TEXT CHECK(patient_gender IN ('M', 'F', 'O')),
      death_datetime DATETIME NOT NULL,
      death_cause TEXT,
      pcr_confirmed INTEGER DEFAULT 0,
      absolute_contraindications TEXT,
      ocular_contraindications TEXT,
      conditions_for_evaluation TEXT,
      cornea_viable INTEGER DEFAULT 0,
      cornea_left_status TEXT DEFAULT 'pending',
      cornea_right_status TEXT DEFAULT 'pending',
      family_consent INTEGER,
      consent_datetime DATETIME,
      consent_by TEXT,
      institution_id INTEGER,
      notified_by_user_id INTEGER,
      notification_datetime DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled')),
      blockchain_tx_hash TEXT,
      blockchain_confirmed INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institution_id) REFERENCES institutions(id),
      FOREIGN KEY (notified_by_user_id) REFERENCES users(id)
    )
  `);

  // Blockchain Transactions
  db.exec(`
    CREATE TABLE IF NOT EXISTS blockchain_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_type TEXT NOT NULL,
      tx_hash TEXT,
      from_address TEXT,
      to_address TEXT,
      gas_used TEXT,
      block_number INTEGER,
      status TEXT DEFAULT 'pending',
      related_notification_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_at DATETIME,
      FOREIGN KEY (related_notification_id) REFERENCES death_notifications(id)
    )
  `);

  // Audit Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Sessions (para autenticação JWT)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Criar admin padrão
  const bcrypt = require('bcryptjs');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@doechain.gov.br';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
  const adminName = process.env.ADMIN_NAME || 'Administrador';

  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync(adminPassword, 10);
    db.prepare(`
      INSERT INTO users (email, password_hash, name, role, active)
      VALUES (?, ?, ?, 'admin', 1)
    `).run(adminEmail, passwordHash, adminName);
    console.log(`✅ Admin criado: ${adminEmail}`);
  }

  console.log('✅ Tabelas criadas com sucesso!');
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

// ========================================
// Express App
// ========================================

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Servir frontend (pages)
const pagesPath = isPkg
  ? path.join(__dirname, 'src', 'pages')
  : path.join(__dirname, 'src', 'pages');

app.use(express.static(pagesPath));

// ========================================
// Servidor
// ========================================

async function startServer() {
  try {
    console.log('\n🏥 DoeChain - Sistema de Notificação de Óbitos\n');
    console.log('📦 Inicializando banco de dados...');
    await initDatabase();
    console.log('✅ Banco de dados pronto!\n');

    // Exportar getDatabase globalmente para os serviços
    global.getDatabase = getDatabase;
    global.DOECHAIN_BASE_DIR = baseDir;

    // Carregar rotas do backend
    const authRoutes = require('./src/services/routes/auth');
    const notificationRoutes = require('./src/services/routes/notifications');
    const institutionRoutes = require('./src/services/routes/institutions');
    const relayRoutes = require('./src/services/routes/relay');

    app.use('/api/auth', authRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/institutions', institutionRoutes);
    app.use('/api/relay', relayRoutes);

    // Health check
    app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'DoeChain API',
        standalone: isPkg
      });
    });

    // SPA fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(pagesPath, 'index.html'));
    });

    // Iniciar servidor
    app.listen(PORT, async () => {
      console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
      console.log(`\n📧 Login: ${process.env.ADMIN_EMAIL || 'admin@doechain.gov.br'}`);
      console.log(`🔑 Senha: ${process.env.ADMIN_PASSWORD || 'admin123456'}\n`);

      // Abrir navegador automaticamente
      try {
        const open = require('open');
        await open(`http://localhost:${PORT}`);
      } catch (e) {
        console.log(`Abra no navegador: http://localhost:${PORT}`);
      }
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    console.error('\nPressione ENTER para fechar...');
    await waitForEnter();
    process.exit(1);
  }
}

// Função para aguardar ENTER
function waitForEnter() {
  return new Promise(resolve => {
    process.stdin.resume();
    process.stdin.once('data', () => resolve());
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Encerrando servidor...');
  if (db) {
    db.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (db) {
    db.close();
  }
  process.exit(0);
});

// Capturar erros não tratados
process.on('uncaughtException', async (error) => {
  console.error('\n❌ Erro fatal:', error.message);
  console.error(error.stack);
  console.error('\nPressione ENTER para fechar...');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(1));
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('\n❌ Promise rejeitada:', reason);
  console.error('\nPressione ENTER para fechar...');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(1));
});

// Iniciar
startServer();

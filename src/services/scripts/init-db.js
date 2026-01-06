/**
 * Script de inicialização do banco de dados SQLite
 * Cria todas as tabelas necessárias para o DoeChain
 */

const path = require('path');
const fs = require('fs');

// Criar pasta data se não existir (na raiz do projeto)
const dataDir = path.join(__dirname, '..', '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('📁 Pasta data/ criada');
}

const { initDatabase, getDatabase, closeDatabase } = require('../config/database');

async function initializeTables() {
  console.log('🔧 Inicializando banco de dados DoeChain...\n');

  await initDatabase();
  const db = getDatabase();

  // ========================================
  // Tabela de Usuários
  // ========================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'hospital', 'iml', 'svo', 'banco_olhos', 'ses')),
      institution_id INTEGER,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      FOREIGN KEY (institution_id) REFERENCES institutions(id)
    )
  `);
  console.log('✅ Tabela users criada');

  // ========================================
  // Tabela de Instituições (Hospitais, IML, etc)
  // ========================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS institutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('hospital', 'iml', 'svo', 'banco_olhos', 'ses')),
      cnes TEXT UNIQUE,
      address TEXT,
      city TEXT,
      state TEXT DEFAULT 'GO',
      phone TEXT,
      email TEXT,
      active INTEGER DEFAULT 1,
      blockchain_registered INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Tabela institutions criada');

  // ========================================
  // Tabela de Notificações de Óbito
  // ========================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS death_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      
      -- Identificação do paciente (anonimizado na blockchain)
      patient_hash TEXT NOT NULL,
      patient_name TEXT,
      patient_cpf_encrypted TEXT,
      patient_age INTEGER,
      patient_gender TEXT CHECK(patient_gender IN ('M', 'F', 'O')),
      
      -- Dados do óbito
      death_datetime DATETIME NOT NULL,
      death_cause TEXT,
      death_location TEXT,
      pcr_confirmed INTEGER DEFAULT 0,
      
      -- Potencial de doação
      cornea_viable INTEGER DEFAULT 0,
      cornea_left_status TEXT DEFAULT 'not_evaluated' CHECK(cornea_left_status IN ('not_evaluated', 'viable', 'not_viable', 'collected', 'transplanted')),
      cornea_right_status TEXT DEFAULT 'not_evaluated' CHECK(cornea_right_status IN ('not_evaluated', 'viable', 'not_viable', 'collected', 'transplanted')),
      contraindications TEXT,
      
      -- Consentimento familiar
      family_contact TEXT,
      family_phone TEXT,
      family_relationship TEXT,
      family_consent INTEGER,
      consent_datetime DATETIME,
      consent_by TEXT,
      
      -- Rastreabilidade
      notified_by_user_id INTEGER NOT NULL,
      institution_id INTEGER NOT NULL,
      notification_datetime DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      -- Blockchain
      blockchain_tx_hash TEXT,
      blockchain_confirmed INTEGER DEFAULT 0,
      blockchain_notification_id INTEGER,
      ipfs_hash TEXT,
      
      -- Integração MV
      source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'mv', 'api')),
      is_automatic INTEGER DEFAULT 0,
      mv_id TEXT,
      mv_prontuario TEXT,
      mv_atendimento TEXT,
      
      -- Status de leitura
      is_read INTEGER DEFAULT 0,
      read_at DATETIME,
      read_by_user_id INTEGER,
      
      -- Controle
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'cancelled', 'completed')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (notified_by_user_id) REFERENCES users(id),
      FOREIGN KEY (institution_id) REFERENCES institutions(id)
    )
  `);
  console.log('✅ Tabela death_notifications criada');

  // ========================================
  // Tabela de Configuração do Sistema
  // ========================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Tabela system_config criada');

  // ========================================
  // Tabela de Logs de Auditoria
  // ========================================
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
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  console.log('✅ Tabela audit_logs criada');

  // ========================================
  // Tabela de Transações Blockchain
  // ========================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS blockchain_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT UNIQUE,
      tx_type TEXT NOT NULL,
      from_address TEXT,
      to_address TEXT,
      gas_used TEXT,
      gas_price TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'failed')),
      block_number INTEGER,
      related_notification_id INTEGER,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_at DATETIME,
      FOREIGN KEY (related_notification_id) REFERENCES death_notifications(id)
    )
  `);
  console.log('✅ Tabela blockchain_transactions criada');

  // ========================================
  // Tabela de Saldo do Relayer
  // ========================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS relayer_balance_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      balance_wei TEXT NOT NULL,
      balance_eth TEXT NOT NULL,
      tx_hash TEXT,
      change_reason TEXT,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Tabela relayer_balance_history criada');

  // ========================================
  // Tabela de Sessões (para JWT revogado)
  // ========================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  console.log('✅ Tabela sessions criada');

  // ========================================
  // Índices para performance
  // ========================================
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_institutions_type ON institutions(type);
    CREATE INDEX IF NOT EXISTS idx_notifications_status ON death_notifications(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_date ON death_notifications(notification_datetime);
    CREATE INDEX IF NOT EXISTS idx_notifications_blockchain ON death_notifications(blockchain_tx_hash);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_tx_hash ON blockchain_transactions(tx_hash);
  `);
  console.log('✅ Índices criados');

  console.log('\n✨ Banco de dados inicializado com sucesso!');
  console.log(`📍 Local: ${path.join(dataDir, 'doechain.db')}`);

  closeDatabase();
}

// Executar
initializeTables().catch(err => {
  console.error('❌ Erro ao inicializar banco:', err);
  process.exit(1);
});

/**
 * Script de migração para adicionar campos de integração MV
 * Executar: node backend/scripts/migrate-mv-fields.js
 */

const path = require('path');
const fs = require('fs');

const { initDatabase, getDatabase, closeDatabase } = require('../config/database');

async function migrate() {
  console.log('🔧 Migrando banco de dados para suporte MV...\n');

  await initDatabase();
  const db = getDatabase();

  // Verificar e adicionar colunas na tabela death_notifications
  const columns = [
    { name: 'source', sql: "ALTER TABLE death_notifications ADD COLUMN source TEXT DEFAULT 'manual'" },
    { name: 'is_automatic', sql: "ALTER TABLE death_notifications ADD COLUMN is_automatic INTEGER DEFAULT 0" },
    { name: 'mv_id', sql: "ALTER TABLE death_notifications ADD COLUMN mv_id TEXT" },
    { name: 'mv_prontuario', sql: "ALTER TABLE death_notifications ADD COLUMN mv_prontuario TEXT" },
    { name: 'mv_atendimento', sql: "ALTER TABLE death_notifications ADD COLUMN mv_atendimento TEXT" },
    { name: 'is_read', sql: "ALTER TABLE death_notifications ADD COLUMN is_read INTEGER DEFAULT 0" },
    { name: 'read_at', sql: "ALTER TABLE death_notifications ADD COLUMN read_at DATETIME" },
    { name: 'read_by_user_id', sql: "ALTER TABLE death_notifications ADD COLUMN read_by_user_id INTEGER" },
    // Campos de contato familiar e contraindications
    { name: 'family_contact', sql: "ALTER TABLE death_notifications ADD COLUMN family_contact TEXT" },
    { name: 'family_phone', sql: "ALTER TABLE death_notifications ADD COLUMN family_phone TEXT" },
    { name: 'family_relationship', sql: "ALTER TABLE death_notifications ADD COLUMN family_relationship TEXT" },
    { name: 'contraindications', sql: "ALTER TABLE death_notifications ADD COLUMN contraindications TEXT" }
  ];

  for (const col of columns) {
    try {
      // Verificar se coluna já existe
      const tableInfo = db.prepare("PRAGMA table_info(death_notifications)").all();
      const exists = tableInfo.some(c => c.name === col.name);

      if (!exists) {
        db.exec(col.sql);
        console.log(`✅ Coluna '${col.name}' adicionada`);
      } else {
        console.log(`⏭️  Coluna '${col.name}' já existe`);
      }
    } catch (error) {
      console.log(`⚠️  Erro ao adicionar coluna '${col.name}':`, error.message);
    }
  }

  // Criar tabela de configuração do sistema se não existir
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela system_config verificada/criada');
  } catch (error) {
    console.log('⚠️  Erro ao criar tabela system_config:', error.message);
  }

  // Inserir configuração padrão da integração MV
  try {
    db.prepare(`
      INSERT OR IGNORE INTO system_config (key, value, description)
      VALUES ('mv_integration_active', 'false', 'Status da integração com API MV')
    `).run();
    console.log('✅ Configuração MV inicializada');
  } catch (error) {
    console.log('⚠️  Erro ao inserir config MV:', error.message);
  }

  // Criar índice para mv_id
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_mv_id ON death_notifications(mv_id)`);
    console.log('✅ Índice idx_notifications_mv_id criado');
  } catch (error) {
    console.log('⚠️  Índice já existe ou erro:', error.message);
  }

  console.log('\n✨ Migração concluída!');

  closeDatabase();
}

// Executar
migrate().catch(err => {
  console.error('❌ Erro na migração:', err);
  process.exit(1);
});

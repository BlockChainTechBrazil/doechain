/**
 * Script para criar o usuário administrador inicial
 */

const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Configurações padrão
const DEFAULT_CONFIG = {
  ADMIN_EMAIL: 'admin@doechain.gov.br',
  ADMIN_PASSWORD: 'admin123456',
  ADMIN_NAME: 'Administrador Sistema'
};

// Garantir que a pasta data existe
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const { initDatabase, getDatabase, closeDatabase } = require('../config/database');

async function createAdmin() {
  console.log('👤 Criando usuário administrador...\n');

  // Inicializar banco
  await initDatabase();
  const db = getDatabase();

  const email = process.env.ADMIN_EMAIL || DEFAULT_CONFIG.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD || DEFAULT_CONFIG.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || DEFAULT_CONFIG.ADMIN_NAME;

  // Verificar se já existe
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  if (existing) {
    console.log(`⚠️  Usuário ${email} já existe!`);
    closeDatabase();
    return;
  }

  // Hash da senha
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  // Inserir admin
  const stmt = db.prepare(`
    INSERT INTO users (email, password_hash, name, role, active)
    VALUES (?, ?, ?, 'admin', 1)
  `);

  const result = stmt.run(email, passwordHash, name);

  console.log('✅ Administrador criado com sucesso!');
  console.log(`   📧 Email: ${email}`);
  console.log(`   🔑 Senha: ${password}`);
  console.log(`   🆔 ID: ${result.lastInsertRowid}`);
  console.log('\n⚠️  IMPORTANTE: Altere a senha após o primeiro login!');

  closeDatabase();
}

createAdmin().catch(err => {
  console.error('❌ Erro ao criar admin:', err);
  process.exit(1);
});

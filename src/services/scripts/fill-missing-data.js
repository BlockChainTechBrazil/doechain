/**
 * Script para preencher dados faltantes nas notificações existentes
 * Como a blockchain é imutável, preenchemos apenas os dados locais do banco
 */

const path = require('path');
const initSqlJs = require('sql.js');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'doechain.db');

// Dados padrão para preenchimento
const DEFAULT_DATA = {
  contraindications: 'Nenhuma contraindicação conhecida',
  family_relationship: 'Familiar próximo'
};

// Nomes e sobrenomes para gerar contatos fictícios
const FIRST_NAMES = ['Maria', 'João', 'Ana', 'Carlos', 'Fernanda', 'Pedro', 'Juliana', 'Lucas', 'Patricia', 'Roberto'];
const LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes'];
const RELATIONSHIPS = ['Filho(a)', 'Cônjuge', 'Irmão(ã)', 'Pai/Mãe', 'Sobrinho(a)', 'Primo(a)', 'Neto(a)'];

// Nomes de pacientes
const PATIENT_FIRST_NAMES = ['José', 'Antônio', 'Francisco', 'Carlos', 'Paulo', 'Pedro', 'Lucas', 'Luiz', 'Marcos', 'Gabriel',
  'Maria', 'Ana', 'Francisca', 'Antônia', 'Adriana', 'Juliana', 'Márcia', 'Fernanda', 'Patricia', 'Aline'];

function generateRandomPhone() {
  const ddd = ['11', '21', '31', '41', '51', '61', '71', '81', '85', '92'][Math.floor(Math.random() * 10)];
  const num1 = Math.floor(Math.random() * 90000) + 10000;
  const num2 = Math.floor(Math.random() * 9000) + 1000;
  return `(${ddd}) 9${num1}-${num2}`;
}

function generateRandomContact() {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${firstName} ${lastName}`;
}

function generateRandomRelationship() {
  return RELATIONSHIPS[Math.floor(Math.random() * RELATIONSHIPS.length)];
}

function generatePatientName() {
  const firstName = PATIENT_FIRST_NAMES[Math.floor(Math.random() * PATIENT_FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const lastName2 = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${firstName} ${lastName} ${lastName2}`;
}

async function fillMissingData() {
  console.log('🔧 Preenchendo dados faltantes nas notificações...\n');

  const SQL = await initSqlJs();

  if (!fs.existsSync(DB_PATH)) {
    console.log('❌ Banco de dados não encontrado. Execute init-db.js primeiro.');
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  try {
    // Buscar todas as notificações com dados faltantes
    const result = db.exec(`
      SELECT id, patient_hash, patient_name, family_consent, family_contact, family_phone, family_relationship, contraindications 
      FROM death_notifications
    `);

    if (!result[0] || result[0].values.length === 0) {
      console.log('ℹ️ Nenhuma notificação encontrada no banco.');
      return;
    }

    const notifications = result[0].values.map(row => ({
      id: row[0],
      patient_hash: row[1],
      patient_name: row[2],
      family_consent: row[3],
      family_contact: row[4],
      family_phone: row[5],
      family_relationship: row[6],
      contraindications: row[7]
    }));

    console.log(`📊 Total de notificações: ${notifications.length}\n`);

    let updatedCount = 0;

    for (const notification of notifications) {
      const updates = [];
      const params = [];

      // Preencher patient_name se vazio
      if (!notification.patient_name) {
        updates.push('patient_name = ?');
        params.push(generatePatientName());
      }

      // Preencher family_contact se vazio
      if (!notification.family_contact) {
        updates.push('family_contact = ?');
        params.push(generateRandomContact());
      }

      // Preencher family_phone se vazio
      if (!notification.family_phone) {
        updates.push('family_phone = ?');
        params.push(generateRandomPhone());
      }

      // Preencher family_relationship se vazio
      if (!notification.family_relationship) {
        updates.push('family_relationship = ?');
        params.push(generateRandomRelationship());
      }

      // Preencher contraindications se vazio
      if (!notification.contraindications) {
        updates.push('contraindications = ?');
        params.push(DEFAULT_DATA.contraindications);
      }

      // Definir family_consent se for null (para notificações antigas)
      if (notification.family_consent === null) {
        // Se não foi definido, colocar como pendente (null significa aguardando)
        // Não vamos mudar pois null = aguardando decisão
      }

      if (updates.length > 0) {
        params.push(notification.id);
        const sql = `UPDATE death_notifications SET ${updates.join(', ')} WHERE id = ?`;
        db.run(sql, params);
        updatedCount++;
        console.log(`✅ Notificação #${notification.id} atualizada`);
      }
    }

    if (updatedCount > 0) {
      // Salvar banco
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
      console.log(`\n💾 Banco de dados salvo!`);
      console.log(`📝 ${updatedCount} notificações atualizadas com dados de contato.`);
    } else {
      console.log('\n✨ Todas as notificações já possuem dados completos!');
    }

  } finally {
    db.close();
  }
}

fillMissingData().catch(console.error);

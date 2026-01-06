/**
 * Script para sincronizar dados do MV Mock para o banco de dados
 * Simula a integração automática com o sistema MV
 */

const { getDatabase, initDatabase, saveDatabase } = require('../config/database');
const crypto = require('crypto');

// Inicializa o banco
console.log('🔄 Sincronizando dados do MV Mock para o banco...\n');
initDatabase();

const db = getDatabase();

// Verificar se já existem dados
const existing = db.prepare('SELECT COUNT(*) as count FROM death_notifications').get();
if (existing.count > 0) {
  console.log(`⚠️  Já existem ${existing.count} notificações no banco.`);
  console.log('   Use --force para sobrescrever.\n');
  if (!process.argv.includes('--force')) {
    process.exit(0);
  }
  console.log('   Limpando dados existentes...\n');
  db.run('DELETE FROM death_notifications');
  db.run('DELETE FROM blockchain_transactions');
}

// Dados para geração
const NOMES_MASCULINOS = ['João', 'José', 'Carlos', 'Paulo', 'Pedro', 'Lucas', 'Marcos', 'André', 'Fernando', 'Rafael'];
const NOMES_FEMININOS = ['Maria', 'Ana', 'Francisca', 'Antônia', 'Adriana', 'Juliana', 'Márcia', 'Fernanda', 'Patricia', 'Aline'];
const SOBRENOMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes'];
const CAUSAS_OBITO = ['Infarto Agudo do Miocárdio', 'AVC', 'Insuficiência Cardíaca', 'Pneumonia', 'Politraumatismo', 'TCE', 'Choque Séptico'];
const LOCAIS = ['UTI Adulto', 'UTI Cardiológica', 'Enfermaria', 'Pronto Socorro', 'Centro Cirúrgico'];

// Verificar/criar instituições
const institutions = [
  { id: 1, name: 'Hospital das Clínicas - UFG', cnes: '2338424', type: 'hospital' },
  { id: 2, name: 'HUGO - Urgências de Goiânia', cnes: '2338416', type: 'hospital' },
  { id: 3, name: 'HUGOL - Urgências Gov. Otávio Lage', cnes: '7489897', type: 'hospital' },
  { id: 4, name: 'Hospital Geral de Goiânia', cnes: '2338432', type: 'hospital' },
  { id: 5, name: 'Banco de Olhos de Goiás', cnes: '0000001', type: 'banco_olhos' }
];

institutions.forEach(inst => {
  const exists = db.prepare('SELECT id FROM institutions WHERE id = ?').get(inst.id);
  if (!exists) {
    db.prepare(`
      INSERT INTO institutions (id, name, cnes, type, active) 
      VALUES (?, ?, ?, ?, 1)
    `).run(inst.id, inst.name, inst.cnes, inst.type);
    console.log(`✅ Instituição criada: ${inst.name}`);
  }
});

function generateCPF() {
  let cpf = '';
  for (let i = 0; i < 11; i++) cpf += Math.floor(Math.random() * 10);
  return cpf;
}

function generateName(gender) {
  const names = gender === 'M' ? NOMES_MASCULINOS : NOMES_FEMININOS;
  const nome = names[Math.floor(Math.random() * names.length)];
  const sobrenome1 = SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)];
  const sobrenome2 = SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)];
  return `${nome} ${sobrenome1} ${sobrenome2}`;
}

function randomDate(daysBack) {
  const now = new Date();
  const past = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
  const random = new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
  return random.toISOString();
}

// Gerar 50 notificações de demonstração
const total = 50;
let blockchainCount = 0;
let corneaViableCount = 0;

console.log(`\n📝 Gerando ${total} notificações de demonstração...\n`);

for (let i = 0; i < total; i++) {
  const gender = Math.random() > 0.5 ? 'M' : 'F';
  const age = 20 + Math.floor(Math.random() * 60); // 20-80 anos
  const cpf = generateCPF();
  const name = generateName(gender);
  const patientHash = crypto.createHash('sha256').update(`${cpf}|${name}|`).digest('hex');

  // 70% são elegíveis para córnea
  const corneaViable = Math.random() < 0.7;
  if (corneaViable) corneaViableCount++;

  // 60% das elegíveis têm consentimento
  let familyConsent = null;
  if (corneaViable) {
    const rand = Math.random();
    if (rand < 0.6) familyConsent = 1;      // Autorizado
    else if (rand < 0.8) familyConsent = 0; // Recusado
    // else permanece null (pendente)
  }

  // 80% são automáticas (MV)
  const isAutomatic = Math.random() < 0.8;
  const source = isAutomatic ? 'mv' : 'manual';

  // 40% já enviadas para blockchain
  const hasBlockchain = Math.random() < 0.4;
  let txHash = null;
  if (hasBlockchain) {
    txHash = '0x' + crypto.randomBytes(32).toString('hex');
    blockchainCount++;
  }

  const institutionId = Math.floor(Math.random() * 4) + 1; // 1-4
  const deathDatetime = randomDate(30); // Últimos 30 dias
  const notificationDatetime = new Date(new Date(deathDatetime).getTime() + (Math.random() * 60 * 60 * 1000)).toISOString(); // +0-60min

  // 70% família comunicada
  const familyNotified = Math.random() < 0.7 ? 1 : 0;

  // Status de córnea
  let corneaLeftCollected = 0, corneaRightCollected = 0;
  let corneaLeftTransplanted = 0, corneaRightTransplanted = 0;
  let collectionDatetime = null, transplantDatetime = null;

  if (corneaViable && familyConsent === 1) {
    // 50% das autorizadas foram coletadas
    if (Math.random() < 0.5) {
      corneaLeftCollected = 1;
      corneaRightCollected = 1;
      collectionDatetime = new Date(new Date(deathDatetime).getTime() + (3 * 60 * 60 * 1000)).toISOString(); // +3h

      // 60% das coletadas foram transplantadas
      if (Math.random() < 0.6) {
        corneaLeftTransplanted = 1;
        corneaRightTransplanted = 1;
        transplantDatetime = new Date(new Date(collectionDatetime).getTime() + (24 * 60 * 60 * 1000)).toISOString(); // +24h
      }
    }
  }

  db.prepare(`
    INSERT INTO death_notifications (
      patient_hash, patient_name, patient_cpf_encrypted, patient_age, patient_gender,
      death_datetime, death_cause, death_location, pcr_confirmed,
      cornea_viable, cornea_left_collected, cornea_right_collected,
      cornea_left_transplanted, cornea_right_transplanted,
      family_notified, family_consent, 
      collection_datetime, transplant_datetime,
      notified_by_user_id, institution_id, notification_datetime,
      source, is_automatic, mv_id,
      blockchain_tx_hash, blockchain_confirmed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    patientHash,
    name,
    Buffer.from(cpf).toString('base64'),
    age,
    gender,
    deathDatetime,
    CAUSAS_OBITO[Math.floor(Math.random() * CAUSAS_OBITO.length)],
    LOCAIS[Math.floor(Math.random() * LOCAIS.length)],
    1, // pcr_confirmed
    corneaViable ? 1 : 0,
    corneaLeftCollected,
    corneaRightCollected,
    corneaLeftTransplanted,
    corneaRightTransplanted,
    familyNotified,
    familyConsent,
    collectionDatetime,
    transplantDatetime,
    1, // admin user
    institutionId,
    notificationDatetime,
    source,
    isAutomatic ? 1 : 0,
    isAutomatic ? `MV${Date.now()}${i.toString().padStart(3, '0')}` : null,
    txHash,
    txHash ? 1 : 0
  );

  // Se tem blockchain, criar transação
  if (txHash) {
    db.prepare(`
      INSERT INTO blockchain_transactions (
        notification_id, tx_hash, status, created_at, confirmed_at
      ) VALUES (?, ?, 'confirmed', ?, ?)
    `).run(i + 1, txHash, notificationDatetime, notificationDatetime);
  }
}

// Salvar
saveDatabase();

console.log(`✅ ${total} notificações criadas com sucesso!`);
console.log(`   📊 Córneas viáveis: ${corneaViableCount}`);
console.log(`   ⛓️  Na blockchain: ${blockchainCount}`);
console.log(`   🔄 Automáticas (MV): ~80%`);
console.log(`   ✍️  Manuais: ~20%`);
console.log('\n🎉 Dados de demonstração prontos!\n');

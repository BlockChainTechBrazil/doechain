/**
 * MVMockService - Simulador da API MV Informática
 * Gera dados fictícios de óbitos para demonstração do sistema
 */

const crypto = require('crypto');

// Dados para geração aleatória
const NOMES_MASCULINOS = [
  'João', 'José', 'Carlos', 'Paulo', 'Pedro', 'Lucas', 'Marcos', 'André',
  'Fernando', 'Rafael', 'Gabriel', 'Bruno', 'Eduardo', 'Ricardo', 'Roberto',
  'Antônio', 'Francisco', 'Luiz', 'Manoel', 'Sebastião', 'Miguel', 'Arthur',
  'Davi', 'Bernardo', 'Heitor', 'Enzo', 'Lorenzo', 'Théo', 'Nicolas', 'Gustavo'
];

const NOMES_FEMININOS = [
  'Maria', 'Ana', 'Francisca', 'Antônia', 'Adriana', 'Juliana', 'Márcia',
  'Fernanda', 'Patricia', 'Aline', 'Sandra', 'Camila', 'Amanda', 'Bruna',
  'Letícia', 'Beatriz', 'Julia', 'Larissa', 'Helena', 'Alice', 'Laura',
  'Sofia', 'Isabella', 'Manuela', 'Valentina', 'Lúcia', 'Gabriela', 'Raquel'
];

const SOBRENOMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves',
  'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho',
  'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha',
  'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado'
];

const CAUSAS_OBITO = [
  'Infarto Agudo do Miocárdio', 'Acidente Vascular Cerebral', 'Insuficiência Cardíaca',
  'Pneumonia', 'Insuficiência Respiratória', 'Choque Séptico', 'Politraumatismo',
  'Traumatismo Cranioencefálico', 'Insuficiência Renal', 'Câncer', 'COVID-19',
  'Embolia Pulmonar', 'Hemorragia Digestiva', 'Arritmia Cardíaca', 'Cirrose Hepática',
  'Infecção Hospitalar', 'Acidente Automobilístico', 'Queda de Altura', 'Afogamento'
];

const LOCAIS = [
  'UTI Adulto', 'UTI Cardiológica', 'Enfermaria', 'Pronto Socorro',
  'Centro Cirúrgico', 'UTI Neurológica', 'Unidade Coronariana', 'PS Emergência'
];

const HOSPITAIS_GOIANIA = [
  { id: 1, name: 'Hospital das Clínicas - UFG', cnes: '2338424' },
  { id: 2, name: 'Hugo - Hospital de Urgências de Goiânia', cnes: '2338416' },
  { id: 3, name: 'HUGOL - Hospital Estadual de Urgências', cnes: '7489897' },
  { id: 4, name: 'Hospital Geral de Goiânia', cnes: '2338432' },
  { id: 5, name: 'Hospital de Doenças Tropicais', cnes: '2338408' },
  { id: 6, name: 'Hospital Santa Casa de Misericórdia', cnes: '2338440' },
  { id: 7, name: 'Hospital Araújo Jorge', cnes: '2338459' },
  { id: 8, name: 'CRER - Centro de Reabilitação', cnes: '6579820' },
  { id: 9, name: 'HMI - Hospital Materno Infantil', cnes: '2338467' },
  { id: 10, name: 'HECAD - Hospital Estadual', cnes: '6752764' }
];

class MVMockService {
  constructor() {
    this.isActive = false;
    this.generatedDeaths = [];
    this.lastGeneratedIndex = 0;
    this.pollingInterval = null;

    // Gerar 100 óbitos iniciais
    this._generateInitialDeaths();
  }

  /**
   * Gera CPF válido aleatório
   */
  _generateCPF() {
    const rand = (n) => Math.floor(Math.random() * n);
    const mod = (dividendo, divisor) => Math.round(dividendo - Math.floor(dividendo / divisor) * divisor);

    const n = Array.from({ length: 9 }, () => rand(9));

    let d1 = n.reduce((acc, val, i) => acc + val * (10 - i), 0);
    d1 = 11 - mod(d1, 11);
    if (d1 >= 10) d1 = 0;

    let d2 = n.reduce((acc, val, i) => acc + val * (11 - i), 0) + d1 * 2;
    d2 = 11 - mod(d2, 11);
    if (d2 >= 10) d2 = 0;

    return `${n.slice(0, 3).join('')}.${n.slice(3, 6).join('')}.${n.slice(6, 9).join('')}-${d1}${d2}`;
  }

  /**
   * Gera nome completo aleatório
   */
  _generateName(gender) {
    const names = gender === 'M' ? NOMES_MASCULINOS : NOMES_FEMININOS;
    const firstName = names[Math.floor(Math.random() * names.length)];
    const middleName = SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)];
    const lastName = SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)];
    return `${firstName} ${middleName} ${lastName}`;
  }

  /**
   * Gera data de óbito (últimas 6 horas - janela crítica para córneas)
   */
  _generateDeathDatetime() {
    const now = new Date();
    // Gera óbitos nas últimas 1-5 horas (dentro da janela crítica)
    const hoursAgo = Math.random() * 4 + 0.5; // 0.5 a 4.5 horas atrás
    const deathTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    return deathTime.toISOString();
  }

  /**
   * Gera data de óbito para dados históricos
   */
  _generateHistoricalDeathDatetime(daysAgo) {
    const now = new Date();
    const hoursAgo = daysAgo * 24 + Math.random() * 24;
    const deathTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    return deathTime.toISOString();
  }

  /**
   * Gera prontuário
   */
  _generateProntuario() {
    return `${Math.floor(Math.random() * 900000) + 100000}`;
  }

  /**
   * Gera atendimento
   */
  _generateAtendimento() {
    return `ATD${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
  }

  /**
   * Gera um óbito simulado
   */
  _generateDeath(index, isRecent = false) {
    const gender = Math.random() > 0.5 ? 'M' : 'F';
    const age = Math.floor(Math.random() * 60) + 20; // 20-80 anos
    const hospital = HOSPITAIS_GOIANIA[Math.floor(Math.random() * HOSPITAIS_GOIANIA.length)];

    // Determinar se é PCR (70% chance para dados realistas)
    const pcrConfirmed = Math.random() > 0.3;

    // Determinar contraindicações (20% chance de ter alguma)
    const hasContraindication = Math.random() < 0.2;
    const contraindications = hasContraindication ?
      [['hiv', 'hepatite_b', 'hepatite_c', 'sepse'][Math.floor(Math.random() * 4)]] : [];

    return {
      mv_id: `MV${Date.now()}${index.toString().padStart(3, '0')}`,
      prontuario: this._generateProntuario(),
      atendimento: this._generateAtendimento(),
      patient_name: this._generateName(gender),
      patient_cpf: this._generateCPF(),
      patient_age: age,
      patient_gender: gender,
      death_datetime: isRecent ? this._generateDeathDatetime() : this._generateHistoricalDeathDatetime(Math.floor(index / 3)),
      death_cause: CAUSAS_OBITO[Math.floor(Math.random() * CAUSAS_OBITO.length)],
      death_location: LOCAIS[Math.floor(Math.random() * LOCAIS.length)],
      pcr_confirmed: pcrConfirmed,
      hospital_id: hospital.id,
      hospital_name: hospital.name,
      hospital_cnes: hospital.cnes,
      contraindications,
      source: 'mv',
      is_automatic: true,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Gera 100 óbitos iniciais (histórico)
   */
  _generateInitialDeaths() {
    this.generatedDeaths = [];
    for (let i = 0; i < 100; i++) {
      this.generatedDeaths.push(this._generateDeath(i, false));
    }
    this.lastGeneratedIndex = 100;
    console.log('[MV Mock] 100 óbitos históricos gerados');
  }

  /**
   * Ativa/Desativa o serviço de polling
   */
  setActive(active) {
    this.isActive = active;
    console.log(`[MV Mock] Serviço ${active ? 'ATIVADO' : 'DESATIVADO'}`);
    return this.isActive;
  }

  /**
   * Retorna status do serviço
   */
  getStatus() {
    return {
      active: this.isActive,
      totalGenerated: this.generatedDeaths.length,
      lastGeneratedIndex: this.lastGeneratedIndex
    };
  }

  /**
   * Busca novos óbitos (simula polling na API MV)
   * Retorna óbitos não processados (novos)
   */
  fetchNewDeaths() {
    if (!this.isActive) {
      return [];
    }

    // Simula 0-3 novos óbitos a cada polling (mais realista)
    const newCount = Math.floor(Math.random() * 4);
    const newDeaths = [];

    for (let i = 0; i < newCount; i++) {
      const death = this._generateDeath(this.lastGeneratedIndex++, true);
      this.generatedDeaths.push(death);
      newDeaths.push(death);
    }

    if (newDeaths.length > 0) {
      console.log(`[MV Mock] ${newDeaths.length} novo(s) óbito(s) gerado(s)`);
    }

    return newDeaths;
  }

  /**
   * Busca óbitos por período
   */
  getDeathsByPeriod(startDate, endDate) {
    return this.generatedDeaths.filter(death => {
      const deathDate = new Date(death.death_datetime);
      return deathDate >= new Date(startDate) && deathDate <= new Date(endDate);
    });
  }

  /**
   * Busca óbito por ID MV
   */
  getDeathByMvId(mvId) {
    return this.generatedDeaths.find(d => d.mv_id === mvId);
  }

  /**
   * Lista todos os óbitos (para debug)
   */
  getAllDeaths() {
    return this.generatedDeaths;
  }

  /**
   * Busca óbitos das últimas N horas (janela crítica)
   */
  getRecentDeaths(hours = 6) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.generatedDeaths.filter(death => {
      return new Date(death.death_datetime) >= cutoff;
    });
  }

  /**
   * Força geração de um novo óbito (para testes)
   */
  forceGenerateDeath() {
    const death = this._generateDeath(this.lastGeneratedIndex++, true);
    this.generatedDeaths.push(death);
    console.log(`[MV Mock] Óbito forçado: ${death.mv_id}`);
    return death;
  }
}

// Singleton
module.exports = new MVMockService();

/**
 * DoeChain - Tipagens compartilhadas
 * Baseado no contrato DeathNotificationRegistry.sol
 */

// ========================================
// Enums (alinhados com o contrato Solidity)
// ========================================

/**
 * Roles de usuário no sistema
 * Deve corresponder ao enum Role no contrato
 */
const Role = {
  NONE: 0,          // Não cadastrado
  ADMIN: 1,         // Administrador do sistema
  HOSPITAL: 2,      // Hospital
  IML: 3,           // Instituto Médico Legal
  SVO: 4,           // Serviço de Verificação de Óbito
  BANCO_OLHOS: 5,   // Banco de Olhos
  SES: 6            // Secretaria Estadual de Saúde
};

/**
 * Mapeamento de role string para enum
 */
const RoleMap = {
  'none': Role.NONE,
  'admin': Role.ADMIN,
  'hospital': Role.HOSPITAL,
  'iml': Role.IML,
  'svo': Role.SVO,
  'banco_olhos': Role.BANCO_OLHOS,
  'ses': Role.SES
};

/**
 * Status da córnea
 * Deve corresponder ao enum CorneaStatus no contrato
 */
const CorneaStatus = {
  NOT_EVALUATED: 0,  // Ainda não avaliado
  VIABLE: 1,         // Córnea viável para doação
  NOT_VIABLE: 2,     // Não viável
  COLLECTED: 3,      // Coletada
  TRANSPLANTED: 4    // Transplantada
};

/**
 * Mapeamento de status string para enum
 */
const CorneaStatusMap = {
  'not_evaluated': CorneaStatus.NOT_EVALUATED,
  'viable': CorneaStatus.VIABLE,
  'not_viable': CorneaStatus.NOT_VIABLE,
  'collected': CorneaStatus.COLLECTED,
  'transplanted': CorneaStatus.TRANSPLANTED
};

/**
 * Status da notificação
 * Deve corresponder ao enum NotificationStatus no contrato
 */
const NotificationStatus = {
  PENDING: 0,    // Pendente de avaliação
  CONFIRMED: 1,  // Confirmado para doação
  CANCELLED: 2,  // Cancelado
  COMPLETED: 3   // Processo concluído
};

/**
 * Mapeamento de status string para enum
 */
const NotificationStatusMap = {
  'pending': NotificationStatus.PENDING,
  'confirmed': NotificationStatus.CONFIRMED,
  'cancelled': NotificationStatus.CANCELLED,
  'completed': NotificationStatus.COMPLETED
};

/**
 * Tipos de transação blockchain
 * Usado na tabela blockchain_transactions
 */
const TransactionType = {
  DEATH_NOTIFICATION: 'death_notification',  // Notificação de óbito
  CONSENT_UPDATE: 'consent_update',          // Atualização de consentimento
  CORNEA_UPDATE: 'cornea_update',            // Atualização de status da córnea
  RELAY: 'relay'                             // Meta-transação via forwarder
};

/**
 * Labels para tipos de transação
 */
const TransactionTypeLabels = {
  [TransactionType.DEATH_NOTIFICATION]: 'Notificação de Óbito',
  [TransactionType.CONSENT_UPDATE]: 'Atualização de Consentimento',
  [TransactionType.CORNEA_UPDATE]: 'Atualização de Córnea',
  [TransactionType.RELAY]: 'Meta-transação'
};

// ========================================
// Estrutura de dados (alinhadas com o contrato)
// ========================================

/**
 * Estrutura da Notificação de Óbito
 * Corresponde à struct DeathNotification no contrato
 * 
 * @typedef {Object} DeathNotification
 * @property {number} id - ID único
 * @property {string} patientHash - Hash anonimizado do paciente (bytes32)
 * @property {number} deathTimestamp - Timestamp do óbito (uint256)
 * @property {number} notificationTimestamp - Timestamp da notificação (uint256)
 * @property {string} notifiedBy - Endereço de quem notificou (address)
 * @property {number} institutionId - ID da instituição (uint256)
 * @property {number} leftEyeStatus - Status córnea esquerda (CorneaStatus enum)
 * @property {number} rightEyeStatus - Status córnea direita (CorneaStatus enum)
 * @property {boolean} familyConsent - Consentimento familiar (bool)
 * @property {number} status - Status da notificação (NotificationStatus enum)
 * @property {string} ipfsHash - Hash IPFS para metadados
 */

/**
 * Estrutura da Instituição
 * Corresponde à struct Institution no contrato
 * 
 * @typedef {Object} Institution
 * @property {number} id - ID único
 * @property {string} name - Nome da instituição
 * @property {number} institutionType - Tipo (Role enum)
 * @property {boolean} active - Se está ativa
 * @property {number} registeredAt - Timestamp de registro
 */

// ========================================
// Dados do formulário (frontend -> backend)
// ========================================

/**
 * Dados para criar notificação (enviados pelo frontend)
 * 
 * @typedef {Object} CreateNotificationDTO
 * @property {string} patientName - Nome do paciente (para gerar hash)
 * @property {string} patientCPF - CPF do paciente (para gerar hash)
 * @property {number|null} patientAge - Idade do paciente
 * @property {string|null} patientGender - Gênero (M/F)
 * @property {string} deathDatetime - Data/hora do óbito (ISO 8601)
 * @property {string} deathCause - Causa do óbito
 * @property {string} deathLocation - Local do óbito
 * @property {boolean} pcrConfirmed - Se PCR foi confirmado
 * @property {number} institutionId - ID da instituição
 * @property {string|null} notes - Observações
 * @property {string[]} contraindications - Lista de contraindicações
 * @property {string|null} familyContact - Nome do contato familiar
 * @property {string|null} familyPhone - Telefone do familiar
 * @property {string|null} familyRelationship - Parentesco
 * @property {boolean|null} familyConsent - Consentimento (true=sim, false=não, null=pendente)
 */

/**
 * Dados para atualizar status da córnea
 * 
 * @typedef {Object} UpdateCorneaDTO
 * @property {string} leftStatus - Status esquerda (not_evaluated|viable|not_viable|collected|transplanted)
 * @property {string} rightStatus - Status direita (not_evaluated|viable|not_viable|collected|transplanted)
 */

/**
 * Dados para registrar consentimento
 * 
 * @typedef {Object} RegisterConsentDTO
 * @property {boolean} consent - true=consentido, false=recusado
 * @property {string} consentBy - Nome do responsável pelo consentimento
 */

// ========================================
// Labels para exibição
// ========================================

const RoleLabels = {
  [Role.NONE]: 'Sem Função',
  [Role.ADMIN]: 'Administrador',
  [Role.HOSPITAL]: 'Hospital',
  [Role.IML]: 'IML',
  [Role.SVO]: 'SVO',
  [Role.BANCO_OLHOS]: 'Banco de Olhos',
  [Role.SES]: 'SES'
};

const CorneaStatusLabels = {
  [CorneaStatus.NOT_EVALUATED]: 'A avaliar',
  [CorneaStatus.VIABLE]: 'Viável',
  [CorneaStatus.NOT_VIABLE]: 'Não viável',
  [CorneaStatus.COLLECTED]: 'Coletada',
  [CorneaStatus.TRANSPLANTED]: 'Transplantada'
};

const NotificationStatusLabels = {
  [NotificationStatus.PENDING]: 'Pendente',
  [NotificationStatus.CONFIRMED]: 'Confirmado',
  [NotificationStatus.CANCELLED]: 'Cancelado',
  [NotificationStatus.COMPLETED]: 'Concluído'
};

// ========================================
// Exportações
// ========================================

module.exports = {
  // Enums
  Role,
  RoleMap,
  CorneaStatus,
  CorneaStatusMap,
  NotificationStatus,
  NotificationStatusMap,
  TransactionType,

  // Labels
  RoleLabels,
  CorneaStatusLabels,
  NotificationStatusLabels,
  TransactionTypeLabels
};

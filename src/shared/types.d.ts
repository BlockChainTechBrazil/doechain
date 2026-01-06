/**
 * DoeChain - TypeScript Type Definitions
 * Baseado no contrato DeathNotificationRegistry.sol
 */

// ========================================
// Enums (alinhados com o contrato Solidity)
// ========================================

/**
 * Roles de usuário no sistema
 * Corresponde ao enum Role no contrato
 */
export enum Role {
  None = 0,         // Não cadastrado
  Admin = 1,        // Administrador do sistema
  Hospital = 2,     // Hospital
  IML = 3,          // Instituto Médico Legal
  SVO = 4,          // Serviço de Verificação de Óbito
  BancoOlhos = 5,   // Banco de Olhos
  SES = 6           // Secretaria Estadual de Saúde
}

/**
 * Status da córnea
 * Corresponde ao enum CorneaStatus no contrato
 */
export enum CorneaStatus {
  NotEvaluated = 0,  // Ainda não avaliado
  Viable = 1,        // Córnea viável para doação
  NotViable = 2,     // Não viável
  Collected = 3,     // Coletada
  Transplanted = 4   // Transplantada
}

/**
 * Status da notificação
 * Corresponde ao enum NotificationStatus no contrato
 */
export enum NotificationStatus {
  Pending = 0,    // Pendente de avaliação
  Confirmed = 1,  // Confirmado para doação
  Cancelled = 2,  // Cancelado
  Completed = 3   // Processo concluído
}

/**
 * Tipos de transação blockchain
 * Usado na tabela blockchain_transactions
 */
export enum TransactionType {
  DeathNotification = 'death_notification',  // Notificação de óbito
  ConsentUpdate = 'consent_update',          // Atualização de consentimento
  CorneaUpdate = 'cornea_update',            // Atualização de status da córnea
  Relay = 'relay'                            // Meta-transação via forwarder
}

// ========================================
// Tipos de dados no Banco de Dados (SQLite)
// ========================================

export type RoleString = 'none' | 'admin' | 'hospital' | 'iml' | 'svo' | 'banco_olhos' | 'ses';
export type CorneaStatusString = 'not_evaluated' | 'viable' | 'not_viable' | 'collected' | 'transplanted';
export type NotificationStatusString = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type TransactionTypeString = 'death_notification' | 'consent_update' | 'cornea_update' | 'relay';
export type TransactionStatusString = 'pending' | 'confirmed' | 'failed';
export type SourceString = 'manual' | 'mv' | 'api';
export type GenderString = 'M' | 'F' | 'O';

// ========================================
// Estruturas do Contrato (Blockchain)
// ========================================

/**
 * Notificação de Óbito na Blockchain
 * Corresponde à struct DeathNotification no contrato
 */
export interface BlockchainDeathNotification {
  id: bigint;
  patientHash: string;        // bytes32
  deathTimestamp: bigint;     // uint256
  notificationTimestamp: bigint; // uint256
  notifiedBy: string;         // address
  institutionId: bigint;      // uint256
  leftEyeStatus: CorneaStatus;
  rightEyeStatus: CorneaStatus;
  familyConsent: boolean;
  status: NotificationStatus;
  ipfsHash: string;
}

/**
 * Instituição na Blockchain
 * Corresponde à struct Institution no contrato
 */
export interface BlockchainInstitution {
  id: bigint;
  name: string;
  institutionType: Role;
  active: boolean;
  registeredAt: bigint;
}

// ========================================
// Estruturas do Banco de Dados (SQLite)
// ========================================

/**
 * Usuário no banco de dados
 */
export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: RoleString;
  institution_id: number | null;
  wallet_address: string | null;
  active: boolean;
  last_login: string | null;
  created_at: string;
}

/**
 * Instituição no banco de dados
 */
export interface Institution {
  id: number;
  name: string;
  type: RoleString;
  cnes: string | null;
  address: string | null;
  city: string | null;
  state: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  blockchain_id: number | null;
  created_at: string;
}

/**
 * Notificação de Óbito no banco de dados
 */
export interface DeathNotification {
  id: number;

  // Identificação do paciente
  patient_hash: string;
  patient_name: string | null;
  patient_cpf_encrypted: string | null;
  patient_age: number | null;
  patient_gender: GenderString | null;

  // Dados do óbito
  death_datetime: string;
  death_cause: string | null;
  death_location: string | null;
  pcr_confirmed: number; // 0 ou 1

  // Potencial de doação
  cornea_viable: number; // 0 ou 1
  cornea_left_status: CorneaStatusString;
  cornea_right_status: CorneaStatusString;
  contraindications: string | null; // JSON array

  // Consentimento familiar
  family_contact: string | null;
  family_phone: string | null;
  family_relationship: string | null;
  family_consent: number | null; // 0=recusado, 1=consentido, null=pendente
  consent_datetime: string | null;
  consent_by: string | null;

  // Rastreabilidade
  notified_by_user_id: number;
  institution_id: number;
  notification_datetime: string;

  // Blockchain
  blockchain_tx_hash: string | null;
  blockchain_confirmed: number; // 0 ou 1
  blockchain_notification_id: number | null;
  ipfs_hash: string | null;

  // Integração MV
  source: SourceString;
  is_automatic: number; // 0 ou 1
  mv_id: string | null;
  mv_prontuario: string | null;
  mv_atendimento: string | null;

  // Status de leitura
  is_read: number; // 0 ou 1
  read_at: string | null;
  read_by_user_id: number | null;

  // Controle
  status: NotificationStatusString;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ========================================
// DTOs (Data Transfer Objects)
// ========================================

/**
 * Dados para criar notificação (frontend -> backend)
 */
export interface CreateNotificationDTO {
  patientName: string;
  patientCPF: string;
  patientAge?: number | null;
  patientGender?: GenderString | null;
  deathDatetime: string;
  deathCause?: string;
  deathLocation?: string;
  pcrConfirmed: boolean;
  institutionId: number;
  notes?: string;
  contraindications?: string[];
  familyContact?: string | null;
  familyPhone?: string | null;
  familyRelationship?: string | null;
  familyConsent?: boolean | null; // true=sim, false=não, null=pendente
}

/**
 * Dados para atualizar status da córnea
 */
export interface UpdateCorneaDTO {
  leftStatus: CorneaStatusString;
  rightStatus: CorneaStatusString;
}

/**
 * Dados para registrar consentimento
 */
export interface RegisterConsentDTO {
  consent: boolean;
  consentBy: string;
}

/**
 * Dados para criar usuário
 */
export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  role: RoleString;
  institutionId: number;
}

/**
 * Dados para criar instituição
 */
export interface CreateInstitutionDTO {
  name: string;
  type: RoleString;
  cnes?: string;
  address?: string;
  city?: string;
  state: string;
  phone?: string;
  email?: string;
}

// ========================================
// Responses
// ========================================

/**
 * Resposta de autenticação
 */
export interface AuthResponse {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: RoleString;
    institutionId: number | null;
    institutionName: string | null;
  };
}

/**
 * Estatísticas do dashboard
 */
export interface DashboardStats {
  totalNotifications: number;
  pendingNotifications: number;
  viableCorneas: number;
  transplantedCorneas: number;
  recentNotifications: DeathNotification[];
}

/**
 * Status do relayer
 */
export interface RelayerStatus {
  configured: boolean;
  address: string | null;
  balance: {
    eth: string;
    wei: string;
  } | null;
  network: string;
}

/**
 * Transação blockchain no banco de dados
 */
export interface BlockchainTransaction {
  id: number;
  tx_type: TransactionTypeString;
  tx_hash: string | null;
  from_address: string | null;
  to_address: string | null;
  gas_used: string | null;
  block_number: number | null;
  status: TransactionStatusString;
  error_message: string | null;
  related_notification_id: number | null;
  created_at: string;
  confirmed_at: string | null;
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title DeathNotificationRegistry
 * @dev Registro de notificações de óbito com potencial de doação de córneas
 * Suporta meta-transactions (gasless) via ERC2771
 */
contract DeathNotificationRegistry is Ownable, ReentrancyGuard, ERC2771Context {
    // ========================================
    // Enums
    // ========================================

    enum Role {
        None, // 0 - Não cadastrado
        Admin, // 1 - Administrador do sistema
        Hospital, // 2 - Hospital
        IML, // 3 - Instituto Médico Legal
        SVO, // 4 - Serviço de Verificação de Óbito
        BancoOlhos, // 5 - Banco de Olhos
        SES // 6 - Secretaria Estadual de Saúde
    }

    enum CorneaStatus {
        NotEvaluated, // 0 - Ainda não avaliado
        Viable, // 1 - Córnea viável para doação
        NotViable, // 2 - Não viável
        Collected, // 3 - Coletada
        Transplanted // 4 - Transplantada
    }

    enum NotificationStatus {
        Pending, // 0 - Pendente de avaliação
        Confirmed, // 1 - Confirmado para doação
        Cancelled, // 2 - Cancelado
        Completed // 3 - Processo concluído
    }

    // ========================================
    // Structs
    // ========================================

    struct DeathNotification {
        uint256 id;
        bytes32 patientHash; // Hash anonimizado do paciente
        uint256 deathTimestamp; // Timestamp do óbito
        uint256 notificationTimestamp; // Timestamp da notificação
        address notifiedBy; // Endereço de quem notificou
        uint256 institutionId; // ID da instituição
        CorneaStatus leftEyeStatus; // Status córnea esquerda
        CorneaStatus rightEyeStatus; // Status córnea direita
        bool familyConsent; // Consentimento familiar
        NotificationStatus status; // Status da notificação
        string ipfsHash; // Hash IPFS para metadados adicionais
    }

    struct Institution {
        uint256 id;
        string name;
        Role institutionType;
        bool active;
        uint256 registeredAt;
    }

    // ========================================
    // State Variables
    // ========================================

    uint256 public notificationCount;
    uint256 public institutionCount;

    mapping(uint256 => DeathNotification) public notifications;
    mapping(address => Role) public userRoles;
    mapping(uint256 => Institution) public institutions;
    mapping(address => uint256) public userInstitution;

    // ========================================
    // Events
    // ========================================

    event DeathNotified(
        uint256 indexed id,
        bytes32 indexed patientHash,
        uint256 institutionId,
        address indexed notifiedBy,
        uint256 timestamp
    );

    event CorneaStatusUpdated(
        uint256 indexed notificationId,
        CorneaStatus leftEye,
        CorneaStatus rightEye,
        address indexed updatedBy
    );

    event ConsentRegistered(
        uint256 indexed notificationId,
        bool consent,
        address indexed registeredBy
    );

    event NotificationStatusChanged(
        uint256 indexed notificationId,
        NotificationStatus oldStatus,
        NotificationStatus newStatus
    );

    event UserRoleAssigned(
        address indexed user,
        Role role,
        uint256 institutionId
    );

    event InstitutionRegistered(
        uint256 indexed id,
        string name,
        Role institutionType
    );

    // ========================================
    // Modifiers
    // ========================================

    modifier onlyRole(Role _role) {
        require(
            userRoles[_msgSender()] == _role,
            "Permissao negada: role incorreta"
        );
        _;
    }

    modifier onlyAuthorizedNotifier() {
        Role senderRole = userRoles[_msgSender()];
        require(
            senderRole == Role.Admin ||
                senderRole == Role.Hospital ||
                senderRole == Role.IML ||
                senderRole == Role.SVO,
            "Nao autorizado a notificar obitos"
        );
        _;
    }

    modifier onlyCorneaManager() {
        Role senderRole = userRoles[_msgSender()];
        require(
            senderRole == Role.Admin ||
                senderRole == Role.BancoOlhos ||
                senderRole == Role.SES,
            "Nao autorizado a gerenciar corneas"
        );
        _;
    }

    modifier validNotification(uint256 _id) {
        require(_id > 0 && _id <= notificationCount, "Notificacao invalida");
        _;
    }

    // ========================================
    // Constructor
    // ========================================

    constructor(
        address initialOwner,
        address trustedForwarder
    ) Ownable(initialOwner) ERC2771Context(trustedForwarder) {
        // Owner é automaticamente admin
        userRoles[initialOwner] = Role.Admin;
        emit UserRoleAssigned(initialOwner, Role.Admin, 0);
    }

    // ========================================
    // Admin Functions
    // ========================================

    /**
     * @dev Atribui role a um usuário
     */
    function assignRole(
        address _user,
        Role _role,
        uint256 _institutionId
    ) external onlyRole(Role.Admin) {
        require(_user != address(0), "Endereco invalido");

        if (_role != Role.None && _role != Role.Admin) {
            require(
                _institutionId > 0 && _institutionId <= institutionCount,
                "Instituicao invalida"
            );
            require(institutions[_institutionId].active, "Instituicao inativa");
        }

        userRoles[_user] = _role;
        userInstitution[_user] = _institutionId;

        emit UserRoleAssigned(_user, _role, _institutionId);
    }

    /**
     * @dev Registra nova instituição
     */
    function registerInstitution(
        string memory _name,
        Role _type
    ) external onlyRole(Role.Admin) returns (uint256) {
        require(
            _type == Role.Hospital ||
                _type == Role.IML ||
                _type == Role.SVO ||
                _type == Role.BancoOlhos ||
                _type == Role.SES,
            "Tipo de instituicao invalido"
        );

        institutionCount++;

        institutions[institutionCount] = Institution({
            id: institutionCount,
            name: _name,
            institutionType: _type,
            active: true,
            registeredAt: block.timestamp
        });

        emit InstitutionRegistered(institutionCount, _name, _type);

        return institutionCount;
    }

    /**
     * @dev Ativa/desativa instituição
     */
    function setInstitutionActive(
        uint256 _id,
        bool _active
    ) external onlyRole(Role.Admin) {
        require(_id > 0 && _id <= institutionCount, "Instituicao invalida");
        institutions[_id].active = _active;
    }

    // ========================================
    // Notification Functions
    // ========================================

    /**
     * @dev Registra nova notificação de óbito
     */
    function notifyDeath(
        bytes32 _patientHash,
        uint256 _deathTimestamp,
        string memory _ipfsHash
    ) external onlyAuthorizedNotifier nonReentrant returns (uint256) {
        require(_patientHash != bytes32(0), "Hash do paciente invalido");
        require(_deathTimestamp <= block.timestamp, "Data de obito invalida");

        uint256 senderInstitution = userInstitution[_msgSender()];
        require(senderInstitution > 0, "Usuario sem instituicao");

        notificationCount++;

        notifications[notificationCount] = DeathNotification({
            id: notificationCount,
            patientHash: _patientHash,
            deathTimestamp: _deathTimestamp,
            notificationTimestamp: block.timestamp,
            notifiedBy: _msgSender(),
            institutionId: senderInstitution,
            leftEyeStatus: CorneaStatus.NotEvaluated,
            rightEyeStatus: CorneaStatus.NotEvaluated,
            familyConsent: false,
            status: NotificationStatus.Pending,
            ipfsHash: _ipfsHash
        });

        emit DeathNotified(
            notificationCount,
            _patientHash,
            senderInstitution,
            _msgSender(),
            block.timestamp
        );

        return notificationCount;
    }

    /**
     * @dev Atualiza status das córneas
     */
    function updateCorneaStatus(
        uint256 _notificationId,
        CorneaStatus _leftEye,
        CorneaStatus _rightEye
    ) external onlyCorneaManager validNotification(_notificationId) {
        DeathNotification storage notification = notifications[_notificationId];

        notification.leftEyeStatus = _leftEye;
        notification.rightEyeStatus = _rightEye;

        emit CorneaStatusUpdated(
            _notificationId,
            _leftEye,
            _rightEye,
            _msgSender()
        );
    }

    /**
     * @dev Registra consentimento familiar
     */
    function registerConsent(
        uint256 _notificationId,
        bool _consent
    ) external onlyAuthorizedNotifier validNotification(_notificationId) {
        DeathNotification storage notification = notifications[_notificationId];

        notification.familyConsent = _consent;

        emit ConsentRegistered(_notificationId, _consent, _msgSender());
    }

    /**
     * @dev Atualiza status da notificação
     */
    function updateNotificationStatus(
        uint256 _notificationId,
        NotificationStatus _newStatus
    ) external onlyCorneaManager validNotification(_notificationId) {
        DeathNotification storage notification = notifications[_notificationId];

        NotificationStatus oldStatus = notification.status;
        notification.status = _newStatus;

        emit NotificationStatusChanged(_notificationId, oldStatus, _newStatus);
    }

    // ========================================
    // View Functions
    // ========================================

    /**
     * @dev Retorna notificação por ID
     */
    function getNotification(
        uint256 _id
    ) external view validNotification(_id) returns (DeathNotification memory) {
        return notifications[_id];
    }

    /**
     * @dev Retorna instituição por ID
     */
    function getInstitution(
        uint256 _id
    ) external view returns (Institution memory) {
        require(_id > 0 && _id <= institutionCount, "Instituicao invalida");
        return institutions[_id];
    }

    /**
     * @dev Retorna role do usuário
     */
    function getUserRole(address _user) external view returns (Role) {
        return userRoles[_user];
    }

    /**
     * @dev Retorna instituição do usuário
     */
    function getUserInstitution(address _user) external view returns (uint256) {
        return userInstitution[_user];
    }

    /**
     * @dev Verifica se notificação tem córneas viáveis
     */
    function hasViableCorneas(
        uint256 _id
    ) external view validNotification(_id) returns (bool) {
        DeathNotification storage n = notifications[_id];
        return
            n.leftEyeStatus == CorneaStatus.Viable ||
            n.rightEyeStatus == CorneaStatus.Viable;
    }

    // ========================================
    // ERC2771 Overrides
    // ========================================

    function _msgSender()
        internal
        view
        override(Context, ERC2771Context)
        returns (address)
    {
        return ERC2771Context._msgSender();
    }

    function _msgData()
        internal
        view
        override(Context, ERC2771Context)
        returns (bytes calldata)
    {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength()
        internal
        view
        override(Context, ERC2771Context)
        returns (uint256)
    {
        return ERC2771Context._contextSuffixLength();
    }
}

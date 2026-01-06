/**
 * DoeChain - Main Application
 */

// Estado global
let currentUser = null;
let institutions = [];

// ========================================
// Estados e Cidades do Brasil
// ========================================

const ESTADOS_BRASIL = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' }
];

// Cache de cidades por estado
const cidadesCache = {};

function populateStateSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = '<option value="">Selecione</option>';
  ESTADOS_BRASIL.forEach(estado => {
    const option = document.createElement('option');
    option.value = estado.sigla;
    option.textContent = `${estado.sigla} - ${estado.nome}`;
    // Pré-seleciona Goiás
    if (estado.sigla === 'GO') option.selected = true;
    select.appendChild(option);
  });

  // Carrega cidades de GO automaticamente
  loadCitiesByState('GO', selectId.replace('state', 'city'));
}

async function loadCitiesByState(uf, citySelectId) {
  const select = document.getElementById(citySelectId);
  if (!select || !uf) {
    if (select) select.innerHTML = '<option value="">Selecione o estado primeiro</option>';
    return;
  }

  select.innerHTML = '<option value="">Carregando...</option>';

  try {
    // Verifica cache
    if (cidadesCache[uf]) {
      populateCitySelect(select, cidadesCache[uf]);
      return;
    }

    // Busca da API do IBGE
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
    const cidades = await response.json();

    cidadesCache[uf] = cidades;
    populateCitySelect(select, cidades);
  } catch (error) {
    console.error('Erro ao carregar cidades:', error);
    select.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

function populateCitySelect(select, cidades) {
  select.innerHTML = '<option value="">Selecione</option>';
  cidades.forEach(cidade => {
    const option = document.createElement('option');
    option.value = cidade.nome;
    option.textContent = cidade.nome;
    select.appendChild(option);
  });
}

// ========================================
// Máscara de Telefone
// ========================================

function maskPhone(input) {
  let value = input.value.replace(/\D/g, '');

  if (value.length > 11) value = value.slice(0, 11);

  if (value.length > 10) {
    // Celular: (XX) XXXXX-XXXX
    value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  } else if (value.length > 6) {
    // Fixo: (XX) XXXX-XXXX
    value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
  } else if (value.length > 2) {
    value = value.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
  } else if (value.length > 0) {
    value = value.replace(/^(\d*)/, '($1');
  }

  input.value = value;
}

// ========================================
// Máscara de CPF
// ========================================

function maskCPF(input) {
  let value = input.value.replace(/\D/g, '');

  if (value.length > 11) value = value.slice(0, 11);

  if (value.length > 9) {
    // CPF completo: 000.000.000-00
    value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2}).*/, '$1.$2.$3-$4');
  } else if (value.length > 6) {
    value = value.replace(/^(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
  } else if (value.length > 3) {
    value = value.replace(/^(\d{3})(\d{0,3})/, '$1.$2');
  }

  input.value = value;
}

// ========================================
// Validação de Data/Hora do Óbito
// ========================================

function validateDeathDatetime(input) {
  const selectedDate = new Date(input.value);
  const now = new Date();

  if (selectedDate > now) {
    showToast('Data/Hora do óbito não pode ser no futuro!', 'error');
    // Ajusta para a hora atual
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    input.value = localNow.toISOString().slice(0, 16);
  }
}

// Define o máximo como "agora" ao carregar o formulário
function setDeathDatetimeMax() {
  const input = document.getElementById('death-datetime');
  if (input) {
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    input.max = localNow.toISOString().slice(0, 16);
  }
}

// ========================================
// Inicialização
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

// Escutar evento de não autorizado para redirecionar ao login
window.addEventListener('auth:unauthorized', () => {
  currentUser = null;
  showLogin();
});

async function initApp() {
  // Verificar se há token salvo
  const token = api.getToken();

  if (token) {
    try {
      currentUser = await api.getMe();
      showDashboard();
    } catch (error) {
      console.error('Sessão expirada:', error);
      api.setToken(null);
      showLogin();
    }
  } else {
    showLogin();
  }

  // Event listeners
  setupEventListeners();
}

function setupEventListeners() {
  // Login form
  document.getElementById('login-form').addEventListener('submit', handleLogin);

  // Logout
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
    });
  });

  // Notification form
  document.getElementById('notification-form').addEventListener('submit', handleNotificationSubmit);

  // User form
  document.getElementById('user-form').addEventListener('submit', handleUserSubmit);

  // Institution form
  document.getElementById('institution-form').addEventListener('submit', handleInstitutionSubmit);

  // Filters
  document.getElementById('filter-status')?.addEventListener('change', loadNotifications);

  // Setup modal close on overlay click
  setupModalCloseOnOverlayClick();
}

// ========================================
// Navigation
// ========================================

function showLogin() {
  document.getElementById('login-page').classList.add('active');
  document.getElementById('dashboard-page').classList.remove('active');
}

function showDashboard() {
  document.getElementById('login-page').classList.remove('active');
  document.getElementById('dashboard-page').classList.add('active');

  // Limpar URL (remover parâmetros sensíveis como email/password)
  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Update user info
  document.getElementById('sidebar-user-name').textContent = currentUser.name;
  document.getElementById('sidebar-user-role').textContent = getRoleLabel(currentUser.role);

  // Update navigation based on role
  updateNavigation();

  // Load initial data
  navigateTo('dashboard');
}

function navigateTo(page) {
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Update content sections
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.toggle('active', section.id === `content-${page}`);
  });

  // Load data for the page
  loadPageData(page);
}

function updateNavigation() {
  const role = currentUser.role;

  document.querySelectorAll('.nav-item[data-roles]').forEach(item => {
    const allowedRoles = item.dataset.roles.split(',');
    item.style.display = allowedRoles.includes(role) ? '' : 'none';
  });
}

async function loadPageData(page) {
  switch (page) {
    case 'dashboard':
      await loadDashboard();
      break;
    case 'notifications':
      await loadNotifications();
      break;
    case 'new-notification':
      await loadNotificationForm();
      break;
    case 'institutions':
      await loadInstitutions();
      break;
    case 'users':
      await loadUsers();
      break;
    case 'relayer':
      await loadRelayer();
      break;
  }
}

// ========================================
// Auth Handlers
// ========================================

async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('login-error');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  try {
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').hidden = true;
    submitBtn.querySelector('.btn-loading').hidden = false;
    errorDiv.hidden = true;

    const result = await api.login(email, password);
    currentUser = result.user;

    showToast('Login realizado com sucesso!', 'success');
    showDashboard();
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').hidden = false;
    submitBtn.querySelector('.btn-loading').hidden = true;
  }
}

async function handleLogout() {
  try {
    await api.logout();
  } catch (error) {
    console.error('Erro no logout:', error);
  }

  currentUser = null;
  showLogin();
  showToast('Logout realizado', 'info');
}

// ========================================
// Dashboard
// ========================================

async function loadDashboard() {
  // Update date
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  try {
    // Verificar saldo do relayer
    await checkRelayerBalance();

    // Load statistics
    const stats = await api.getStatistics();
    document.getElementById('stat-total').textContent = stats.total || 0;
    document.getElementById('stat-viable').textContent = stats.corneaViable || 0;
    document.getElementById('stat-pending').textContent = stats.pending || 0;
    document.getElementById('stat-blockchain').textContent = stats.blockchainConfirmed || 0;

    // Load recent notifications
    const notifications = await api.getNotifications({ limit: 5 });
    renderRecentNotifications(notifications);
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    showToast('Erro ao carregar dados', 'error');
  }
}

function renderRecentNotifications(notifications) {
  const tbody = document.getElementById('recent-notifications-body');

  if (!notifications || notifications.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma notificação encontrada</td></tr>';
    return;
  }

  tbody.innerHTML = notifications.map(n => `
    <tr>
      <td>#${n.id}</td>
      <td>${formatDateTime(n.death_datetime)}</td>
      <td>${n.institution_name || '-'}</td>
      <td>
        <span class="badge ${n.cornea_viable ? 'badge-success' : 'badge-default'}">
          ${n.cornea_viable ? 'Viável' : 'A avaliar'}
        </span>
      </td>
      <td>
        <span class="badge badge-${getStatusBadge(n.status)}">${getStatusLabel(n.status)}</span>
      </td>
      <td>
        <button class="btn btn-sm" onclick="viewNotification(${n.id})">Ver</button>
      </td>
    </tr>
  `).join('');
}

// ========================================
// Notifications
// ========================================

async function loadNotifications() {
  try {
    // Verificar saldo do relayer para mostrar status correto
    await checkRelayerBalance();

    const status = document.getElementById('filter-status')?.value;
    const notifications = await api.getNotifications({ status, limit: 100 });
    renderNotificationsList(notifications);
  } catch (error) {
    console.error('Erro ao carregar notificações:', error);
    showToast('Erro ao carregar notificações', 'error');
  }
}

// Cache do status do relayer
let relayerHasBalance = null;

async function checkRelayerBalance() {
  try {
    const status = await api.getRelayerStatus();
    if (status.balance?.eth) {
      relayerHasBalance = parseFloat(status.balance.eth) >= 0.001; // Mínimo para uma transação
    } else {
      relayerHasBalance = false;
    }
  } catch (error) {
    relayerHasBalance = false;
  }
  return relayerHasBalance;
}

function getBlockchainStatusHtml(notification) {
  if (notification.blockchain_tx_hash) {
    return `<a href="https://sepolia.etherscan.io/tx/${notification.blockchain_tx_hash}" target="_blank" title="${notification.blockchain_tx_hash}">⛓️</a>`;
  }

  // Se não tem tx hash, verificar motivo
  if (relayerHasBalance === false) {
    return '<span class="badge badge-danger" title="Relayer sem saldo para transações">💸 Sem saldo</span>';
  }

  return '<span class="badge badge-warning" title="Pendente envio para blockchain">⏳ Pendente</span>';
}

function renderNotificationsList(notifications) {
  const tbody = document.getElementById('notifications-list-body');

  if (!notifications || notifications.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhuma notificação encontrada</td></tr>';
    return;
  }

  tbody.innerHTML = notifications.map(n => `
    <tr>
      <td>#${n.id}</td>
      <td title="${n.patient_hash}">${n.patient_hash?.substring(0, 10)}...</td>
      <td>${formatDateTime(n.death_datetime)}</td>
      <td>${n.institution_name || '-'}</td>
      <td>${n.family_consent === 1 ? '✅ Sim' : n.family_consent === 0 ? '❌ Não' : '⏳'}</td>
      <td><span class="badge badge-${getCorneaBadge(n.cornea_left_status)}">${getCorneaLabel(n.cornea_left_status)}</span></td>
      <td><span class="badge badge-${getCorneaBadge(n.cornea_right_status)}">${getCorneaLabel(n.cornea_right_status)}</span></td>
      <td>${getBlockchainStatusHtml(n)}</td>
      <td>
        <button class="btn btn-sm" onclick="viewNotification(${n.id})">Ver</button>
      </td>
    </tr>
  `).join('');
}

async function loadNotificationForm() {
  // Define o máximo de data/hora como agora
  setDeathDatetimeMax();

  // Load institutions for select
  try {
    institutions = await api.getInstitutions({ active: true });
    const select = document.getElementById('institution-id');
    select.innerHTML = '<option value="">Selecione</option>' +
      institutions.map(i => `<option value="${i.id}">${i.name} (${getTypeLabel(i.type)})</option>`).join('');
  } catch (error) {
    console.error('Erro ao carregar instituições:', error);
  }
}

async function handleNotificationSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const errorDiv = document.getElementById('notification-error');
  const successDiv = document.getElementById('notification-success');

  // Coletar contraindicações
  const contraindications = Array.from(
    form.querySelectorAll('input[name="contraindications"]:checked')
  ).map(cb => cb.value);

  const contraindicationsOcular = Array.from(
    form.querySelectorAll('input[name="contraindications_ocular"]:checked')
  ).map(cb => cb.value);

  const contraindicationsEvaluate = Array.from(
    form.querySelectorAll('input[name="contraindications_evaluate"]:checked')
  ).map(cb => cb.value);

  const data = {
    patientName: form.patientName.value,
    patientCPF: form.patientCPF.value.replace(/\D/g, ''),
    patientAge: form.patientAge.value ? parseInt(form.patientAge.value) : null,
    patientGender: form.patientGender.value || null,
    deathDatetime: form.deathDatetime.value,
    deathCause: form.deathCause.value,
    deathLocation: form.deathLocation.value,
    pcrConfirmed: form.pcrConfirmed.checked,
    institutionId: parseInt(form.institutionId.value),
    notes: form.notes.value,
    // Novos campos de elegibilidade
    contraindications: [...contraindications, ...contraindicationsOcular, ...contraindicationsEvaluate],
    familyContact: form.familyContact?.value || null,
    familyPhone: form.familyPhone?.value || null,
    familyRelationship: form.familyRelationship?.value || null,
    familyConsent: form.familyConsent?.checked ? true : (form.familyRefusal?.checked ? false : null)
  };

  try {
    errorDiv.hidden = true;
    successDiv.hidden = true;

    await api.createNotification(data);

    successDiv.textContent = 'Notificação registrada com sucesso! O Banco de Olhos foi notificado.';
    successDiv.hidden = false;
    form.reset();

    // Resetar timer
    if (criticalTimerInterval) {
      clearInterval(criticalTimerInterval);
      criticalTimerInterval = null;
    }
    document.getElementById('critical-window-timer').hidden = true;

    showToast('Notificação criada com sucesso!', 'success');

    setTimeout(() => navigateTo('notifications'), 2000);
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.hidden = false;
  }
}

let currentNotificationId = null;

async function viewNotification(id) {
  try {
    const notification = await api.getNotification(id);
    currentNotificationId = id;

    // Preencher dados do modal
    document.getElementById('detail-notification-id').textContent = `#${notification.id}`;
    document.getElementById('detail-patient-hash').textContent = notification.patient_hash || '-';
    document.getElementById('detail-patient-age').textContent = notification.patient_age ? `${notification.patient_age} anos` : '-';
    document.getElementById('detail-patient-gender').textContent = getGenderLabel(notification.patient_gender);

    document.getElementById('detail-death-datetime').textContent = formatDateTime(notification.death_datetime);
    document.getElementById('detail-institution').textContent = notification.institution_name || '-';
    document.getElementById('detail-death-cause').textContent = notification.death_cause || '-';
    document.getElementById('detail-death-location').textContent = notification.death_location || '-';
    document.getElementById('detail-pcr').textContent = notification.pcr_confirmed ? '✅ Confirmado' : '❌ Não';

    // Consentimento
    const consentStatus = notification.family_consent === 1 ? '✅ Autorizado' :
      notification.family_consent === 0 ? '❌ Recusado' : '⏳ Aguardando';
    document.getElementById('detail-consent-status').innerHTML = `<span class="badge badge-${notification.family_consent === 1 ? 'success' : notification.family_consent === 0 ? 'danger' : 'warning'}">${consentStatus}</span>`;
    document.getElementById('detail-family-contact').textContent = notification.family_contact || '-';
    document.getElementById('detail-family-phone').textContent = notification.family_phone || '-';
    document.getElementById('detail-family-relationship').textContent = getRelationshipLabel(notification.family_relationship);

    // Córneas
    document.getElementById('detail-cornea-left').innerHTML = `<span class="badge badge-${getCorneaBadge(notification.cornea_left_status)}">${getCorneaLabel(notification.cornea_left_status)}</span>`;
    document.getElementById('detail-cornea-right').innerHTML = `<span class="badge badge-${getCorneaBadge(notification.cornea_right_status)}">${getCorneaLabel(notification.cornea_right_status)}</span>`;

    // Contraindicações
    const contraindications = [];
    if (notification.contraindications) contraindications.push(...notification.contraindications.split(','));
    if (notification.contraindications_ocular) contraindications.push(...notification.contraindications_ocular.split(','));
    document.getElementById('detail-contraindications').textContent = contraindications.length > 0 ? contraindications.join(', ') : 'Nenhuma';

    // Blockchain
    if (notification.blockchain_tx_hash) {
      document.getElementById('detail-blockchain-tx').innerHTML = `<a href="https://sepolia.etherscan.io/tx/${notification.blockchain_tx_hash}" target="_blank" class="tx-link">${notification.blockchain_tx_hash.substring(0, 20)}...</a>`;
      document.getElementById('detail-blockchain-btn').style.display = 'none';
    } else {
      document.getElementById('detail-blockchain-tx').textContent = 'Não registrado';
      document.getElementById('detail-blockchain-btn').style.display = 'inline-flex';
    }

    // Observações
    const notesSection = document.getElementById('detail-notes-section');
    const notesEl = document.getElementById('detail-notes');
    if (notification.notes) {
      notesEl.textContent = notification.notes;
      notesSection.style.display = 'block';
    } else {
      notesSection.style.display = 'none';
    }

    showModal('notification-detail-modal');
  } catch (error) {
    console.error('Erro ao carregar notificação:', error);
    showToast('Erro ao carregar detalhes da notificação', 'error');
  }
}

async function sendToBlockchain() {
  if (!currentNotificationId) return;

  const btn = document.getElementById('detail-blockchain-btn');
  const txDisplay = document.getElementById('detail-blockchain-tx');
  const originalBtnText = btn.innerHTML;

  try {
    // Mostrar estado de carregamento
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Enviando...';
    txDisplay.innerHTML = '<span class="loading-text">⏳ Processando transação na blockchain...</span>';

    showToast('Enviando para blockchain...', 'info');
    const result = await api.submitToBlockchain(currentNotificationId);

    // txHash pode vir direto ou via blockchain_tx_hash do banco
    const txHash = result.txHash || result.blockchain_tx_hash;

    if (txHash) {
      txDisplay.innerHTML = `<a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank" class="tx-link">${txHash.substring(0, 20)}...</a>`;
      btn.style.display = 'none';
      showToast('✅ Registrado na blockchain com sucesso!', 'success');
      loadNotifications();
      loadDashboard();
    } else {
      throw new Error('Transação não retornou hash');
    }
  } catch (error) {
    console.error('Erro ao enviar para blockchain:', error);

    // Mostrar erro na interface
    const errorMsg = error.message || 'Erro ao enviar para blockchain';
    txDisplay.innerHTML = `<span class="tx-error">❌ ${errorMsg}</span>`;
    showToast(errorMsg, 'error');

    // Restaurar botão em caso de erro
    btn.disabled = false;
    btn.innerHTML = originalBtnText;
  }
}

function getGenderLabel(gender) {
  const labels = { 'M': 'Masculino', 'F': 'Feminino', 'O': 'Outro' };
  return labels[gender] || '-';
}

function getRelationshipLabel(relationship) {
  const labels = {
    'conjuge': 'Cônjuge',
    'filho': 'Filho(a)',
    'pai_mae': 'Pai/Mãe',
    'irmao': 'Irmão(ã)',
    'outro': 'Outro'
  };
  return labels[relationship] || '-';
}

// ========================================
// Institutions
// ========================================

async function loadInstitutions() {
  try {
    const data = await api.getInstitutions();
    renderInstitutionsList(data);
  } catch (error) {
    console.error('Erro ao carregar instituições:', error);
    showToast('Erro ao carregar instituições', 'error');
  }
}

function renderInstitutionsList(data) {
  const tbody = document.getElementById('institutions-list-body');

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma instituição cadastrada</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(i => `
    <tr>
      <td>#${i.id}</td>
      <td>${i.name}</td>
      <td>${getTypeLabel(i.type)}</td>
      <td>${i.cnes || '-'}</td>
      <td>${i.city || '-'}</td>
      <td><span class="badge badge-${i.active ? 'success' : 'danger'}">${i.active ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <button class="btn btn-sm" onclick="editInstitution(${i.id})">Editar</button>
      </td>
    </tr>
  `).join('');
}

async function handleInstitutionSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const data = {
    name: form.name.value,
    type: form.type.value,
    cnes: form.cnes.value || null,
    address: form.address.value || null,
    city: form.city.value || null,
    state: form.state.value || 'GO',
    phone: form.phone.value ? form.phone.value.replace(/\D/g, '') : null,
    email: form.email.value || null
  };

  try {
    await api.createInstitution(data);
    hideModal('institution-modal');
    form.reset();
    showToast('Instituição criada!', 'success');
    loadInstitutions();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function editInstitution(id) {
  showToast(`Editar instituição #${id}`, 'info');
}

// ========================================
// Users
// ========================================

async function loadUsers() {
  try {
    const [users, institutionsList] = await Promise.all([
      api.getUsers(),
      api.getInstitutions()
    ]);

    institutions = institutionsList;
    renderUsersList(users);

    // Update institution select in modal
    const select = document.getElementById('user-institution');
    select.innerHTML = '<option value="">Nenhuma</option>' +
      institutions.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
    showToast('Erro ao carregar usuários', 'error');
  }
}

function renderUsersList(users) {
  const tbody = document.getElementById('users-list-body');

  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum usuário cadastrado</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td>#${u.id}</td>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td>${getRoleLabel(u.role)}</td>
      <td>${u.institution_name || '-'}</td>
      <td><span class="badge badge-${u.active ? 'success' : 'danger'}">${u.active ? 'Ativo' : 'Inativo'}</span></td>
      <td>${u.last_login ? formatDateTime(u.last_login) : 'Nunca'}</td>
      <td>
        <button class="btn btn-sm" onclick="editUser(${u.id})">Editar</button>
      </td>
    </tr>
  `).join('');
}

async function handleUserSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const data = {
    name: form.name.value,
    email: form.email.value,
    password: form.password.value,
    role: form.role.value,
    institutionId: form.institutionId.value ? parseInt(form.institutionId.value) : null
  };

  try {
    await api.createUser(data);
    hideModal('user-modal');
    form.reset();
    showToast('Usuário criado!', 'success');
    loadUsers();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function editUser(id) {
  showToast(`Editar usuário #${id}`, 'info');
}

// ========================================
// Relayer
// ========================================

async function loadRelayer() {
  await refreshRelayerStatus();
  await loadRelayerTransactions();
}

async function refreshRelayerStatus() {
  try {
    const status = await api.getRelayerStatus();

    // Status - Relayer sempre configurado
    document.getElementById('relayer-status').innerHTML = status.configured
      ? '<span class="badge badge-success">✅ Ativo</span>'
      : '<span class="badge badge-warning">⏳ Verificando...</span>';

    // Endereço
    if (status.address) {
      const shortAddr = `${status.address.substring(0, 6)}...${status.address.substring(38)}`;
      document.getElementById('relayer-address').innerHTML = `<a href="https://sepolia.etherscan.io/address/${status.address}" target="_blank" title="${status.address}">${shortAddr}</a>`;
    } else {
      document.getElementById('relayer-address').textContent = '-';
    }

    // Saldo
    if (status.balance?.eth) {
      const eth = parseFloat(status.balance.eth);
      const color = eth < 0.01 ? 'color: var(--danger)' : eth < 0.05 ? 'color: var(--warning)' : 'color: var(--success)';
      document.getElementById('relayer-balance').innerHTML = `<span style="${color}; font-weight: 600;">${eth.toFixed(6)} ETH</span>`;
    } else {
      document.getElementById('relayer-balance').textContent = '-';
    }
  } catch (error) {
    console.error('Erro ao carregar status do relayer:', error);
    showToast('Erro ao carregar status do relayer', 'error');
  }
}

async function loadRelayerTransactions() {
  try {
    const transactions = await api.getRelayerTransactions(20);
    renderRelayerTransactions(transactions);
  } catch (error) {
    console.error('Erro ao carregar transações:', error);
  }
}

function renderRelayerTransactions(transactions) {
  const tbody = document.getElementById('relayer-tx-body');

  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhuma transação</td></tr>';
    return;
  }

  tbody.innerHTML = transactions.map(tx => `
    <tr>
      <td title="${tx.tx_hash || '-'}">${tx.tx_hash ? tx.tx_hash.substring(0, 10) + '...' : '-'}</td>
      <td>${tx.tx_type}</td>
      <td><span class="badge badge-${tx.status === 'confirmed' ? 'success' : tx.status === 'failed' ? 'danger' : 'warning'}">${tx.status}</span></td>
      <td>${formatDateTime(tx.created_at)}</td>
    </tr>
  `).join('');
}

// ========================================
// Modals
// ========================================

function showModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add('active');

  // Inicializa selects de estado/cidade para modal de instituição
  if (id === 'institution-modal') {
    populateStateSelect('inst-state');
  }
}

function hideModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Fechar modal ao clicar fora dele (no overlay)
function setupModalCloseOnOverlayClick() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      // Verifica se o clique foi diretamente no overlay (modal) e não no conteúdo
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
}

// ========================================
// Toast Notifications
// ========================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========================================
// Helpers
// ========================================

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('pt-BR');
}

function getRoleLabel(role) {
  const labels = {
    admin: 'Administrador',
    hospital: 'Hospital',
    iml: 'IML',
    svo: 'SVO',
    banco_olhos: 'Banco de Olhos',
    ses: 'SES'
  };
  return labels[role] || role;
}

function getTypeLabel(type) {
  return getRoleLabel(type);
}

function getStatusLabel(status) {
  const labels = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    cancelled: 'Cancelado',
    completed: 'Concluído'
  };
  return labels[status] || status;
}

function getStatusBadge(status) {
  const badges = {
    pending: 'warning',
    confirmed: 'success',
    cancelled: 'danger',
    completed: 'info'
  };
  return badges[status] || 'default';
}

function getCorneaLabel(status) {
  const labels = {
    not_evaluated: 'A avaliar',
    viable: 'Viável',
    not_viable: 'Não viável',
    collected: 'Coletada',
    transplanted: 'Transplantada'
  };
  return labels[status] || status;
}

function getCorneaBadge(status) {
  const badges = {
    not_evaluated: 'default',
    viable: 'success',
    not_viable: 'danger',
    collected: 'info',
    transplanted: 'primary'
  };
  return badges[status] || 'default';
}

// ========================================
// Cornea Eligibility & Critical Timer
// ========================================

// Contraindicações absolutas que impedem doação de córneas
const ABSOLUTE_CONTRAINDICATIONS = [
  'hiv', 'hepatite_b', 'hepatite_c', 'raiva', 'creutzfeldt_jakob',
  'sepse', 'leucemia', 'tuberculose', 'htlv', 'causa_desconhecida'
];

// Contraindicações oculares
const OCULAR_CONTRAINDICATIONS = [
  'cirurgia_refrativa', 'ceratocone', 'distrofia_cornea',
  'glaucoma', 'infeccao_ocular', 'tumor_ocular'
];

// Condições que requerem avaliação
const EVALUATE_CONDITIONS = [
  'neoplasia', 'diabetes', 'uso_drogas', 'comportamento_risco'
];

// Timer global
let criticalTimerInterval = null;

/**
 * Atualiza o timer de janela crítica (6 horas para córneas)
 */
function updateCriticalTimer() {
  const deathDatetime = document.getElementById('death-datetime').value;
  const timerContainer = document.getElementById('critical-window-timer');

  if (!deathDatetime) {
    timerContainer.hidden = true;
    if (criticalTimerInterval) {
      clearInterval(criticalTimerInterval);
      criticalTimerInterval = null;
    }
    return;
  }

  timerContainer.hidden = false;

  // Limpar intervalo anterior
  if (criticalTimerInterval) {
    clearInterval(criticalTimerInterval);
  }

  // Calcular e atualizar a cada segundo
  function updateTimer() {
    const deathTime = new Date(deathDatetime).getTime();
    const now = Date.now();
    const criticalWindow = 6 * 60 * 60 * 1000; // 6 horas em ms
    const deadline = deathTime + criticalWindow;
    const remaining = deadline - now;

    const timerValue = document.getElementById('timer-countdown');
    const timerStatus = document.getElementById('timer-status');
    const statusText = timerStatus.querySelector('.status-text');
    const summaryTime = document.getElementById('summary-time');

    if (remaining <= 0) {
      // Janela expirada
      timerContainer.className = 'critical-timer expired';
      timerValue.textContent = '00:00:00';
      statusText.textContent = 'Expirado';
      summaryTime.textContent = 'Expirado';
      summaryTime.style.color = 'var(--gray-500)';

      if (criticalTimerInterval) {
        clearInterval(criticalTimerInterval);
        criticalTimerInterval = null;
      }
    } else {
      // Calcular horas, minutos, segundos
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      timerValue.textContent = timeString;
      summaryTime.textContent = timeString;

      // Definir status baseado no tempo restante
      if (remaining <= 1 * 60 * 60 * 1000) {
        // Menos de 1 hora - crítico
        timerContainer.className = 'critical-timer critical';
        statusText.textContent = 'URGENTE!';
        summaryTime.style.color = 'var(--danger)';
      } else if (remaining <= 2 * 60 * 60 * 1000) {
        // 1-2 horas - atenção
        timerContainer.className = 'critical-timer';
        statusText.textContent = 'Atenção';
        summaryTime.style.color = 'var(--warning)';
      } else {
        // Mais de 2 horas - seguro
        timerContainer.className = 'critical-timer safe';
        statusText.textContent = 'Dentro do prazo';
        summaryTime.style.color = 'var(--success)';
      }
    }
  }

  // Atualizar imediatamente e depois a cada segundo
  updateTimer();
  criticalTimerInterval = setInterval(updateTimer, 1000);

  // Atualizar elegibilidade também
  updateEligibility();
}

/**
 * Atualiza o status de elegibilidade baseado nas contraindicações
 */
function updateEligibility() {
  const eligibilityCard = document.getElementById('eligibility-card');
  const eligibilityIcon = document.getElementById('eligibility-icon');
  const eligibilityTitle = document.getElementById('eligibility-title');
  const eligibilityDesc = document.getElementById('eligibility-description');
  const eligibilityReasons = document.getElementById('eligibility-reasons');
  const eligibilityReasonsList = document.getElementById('eligibility-reasons-list');
  const summaryEligibility = document.getElementById('summary-eligibility');

  const corneaLeft = document.getElementById('cornea-left');
  const corneaRight = document.getElementById('cornea-right');
  const corneaLeftStatus = document.getElementById('cornea-left-status');
  const corneaRightStatus = document.getElementById('cornea-right-status');

  // Coletar contraindicações marcadas
  const absoluteChecked = Array.from(
    document.querySelectorAll('input[name="contraindications"]:checked')
  ).map(cb => cb.value);

  const ocularChecked = Array.from(
    document.querySelectorAll('input[name="contraindications_ocular"]:checked')
  ).map(cb => cb.value);

  const evaluateChecked = Array.from(
    document.querySelectorAll('input[name="contraindications_evaluate"]:checked')
  ).map(cb => cb.value);

  // Verificar PCR confirmado
  const pcrConfirmed = document.getElementById('pcr-confirmed').checked;

  // Verificar idade
  const age = parseInt(document.getElementById('patient-age').value) || 0;

  // Verificar tempo restante
  const deathDatetime = document.getElementById('death-datetime').value;
  let timeExpired = false;
  if (deathDatetime) {
    const deathTime = new Date(deathDatetime).getTime();
    const criticalWindow = 6 * 60 * 60 * 1000;
    timeExpired = (Date.now() - deathTime) > criticalWindow;
  }

  // Calcular elegibilidade
  const reasons = [];
  let isEligible = true;
  let needsEvaluation = false;

  // Verificar contraindicações absolutas
  if (absoluteChecked.length > 0) {
    isEligible = false;
    absoluteChecked.forEach(ci => {
      reasons.push(getContraindicationLabel(ci) + ' (Contraindicação Absoluta)');
    });
  }

  // Verificar contraindicações oculares
  if (ocularChecked.length > 0) {
    isEligible = false;
    ocularChecked.forEach(ci => {
      reasons.push(getContraindicationLabel(ci) + ' (Contraindicação Ocular)');
    });
  }

  // Verificar condições para avaliação
  if (evaluateChecked.length > 0) {
    needsEvaluation = true;
    evaluateChecked.forEach(ci => {
      reasons.push(getContraindicationLabel(ci) + ' (Requer Avaliação)');
    });
  }

  // Verificar idade
  if (age > 80) {
    needsEvaluation = true;
    reasons.push('Idade acima de 80 anos (Requer Avaliação)');
  }

  // Verificar tempo
  if (timeExpired) {
    isEligible = false;
    reasons.push('Janela crítica de 6 horas expirada');
  }

  // Verificar PCR
  if (!pcrConfirmed && deathDatetime) {
    needsEvaluation = true;
    reasons.push('PCR não confirmado - Verificar se é potencial doador');
  }

  // Atualizar UI
  eligibilityCard.classList.remove('eligibility-pending', 'eligibility-eligible', 'eligibility-ineligible', 'eligibility-partial');
  corneaLeft.classList.remove('eligible', 'ineligible', 'evaluate');
  corneaRight.classList.remove('eligible', 'ineligible', 'evaluate');

  if (!deathDatetime) {
    // Sem data de óbito - pendente
    eligibilityCard.classList.add('eligibility-pending');
    eligibilityTitle.textContent = 'Aguardando Avaliação';
    eligibilityDesc.textContent = 'Preencha os campos para verificar elegibilidade';
    summaryEligibility.textContent = 'Pendente';
    summaryEligibility.style.color = 'var(--gray-600)';
    corneaLeftStatus.textContent = '—';
    corneaRightStatus.textContent = '—';
    eligibilityReasons.hidden = true;
  } else if (!isEligible) {
    // Não elegível
    eligibilityCard.classList.add('eligibility-ineligible');
    eligibilityTitle.textContent = '❌ Não Elegível para Doação';
    eligibilityDesc.textContent = 'Existem contraindicações que impedem a doação';
    summaryEligibility.textContent = 'Não Elegível';
    summaryEligibility.style.color = 'var(--danger)';
    corneaLeft.classList.add('ineligible');
    corneaRight.classList.add('ineligible');
    corneaLeftStatus.textContent = 'Não Viável';
    corneaRightStatus.textContent = 'Não Viável';
    eligibilityReasons.hidden = false;
    eligibilityReasonsList.innerHTML = reasons.map(r => `<li>${r}</li>`).join('');
  } else if (needsEvaluation) {
    // Precisa de avaliação
    eligibilityCard.classList.add('eligibility-partial');
    eligibilityTitle.textContent = '⚠️ Requer Avaliação Médica';
    eligibilityDesc.textContent = 'Algumas condições precisam ser avaliadas pelo Banco de Olhos';
    summaryEligibility.textContent = 'Avaliar';
    summaryEligibility.style.color = 'var(--warning)';
    corneaLeft.classList.add('evaluate');
    corneaRight.classList.add('evaluate');
    corneaLeftStatus.textContent = 'A Avaliar';
    corneaRightStatus.textContent = 'A Avaliar';
    eligibilityReasons.hidden = false;
    eligibilityReasonsList.innerHTML = reasons.map(r => `<li>${r}</li>`).join('');
  } else {
    // Elegível
    eligibilityCard.classList.add('eligibility-eligible');
    eligibilityTitle.textContent = '✅ Potencial Doador de Córneas';
    eligibilityDesc.textContent = 'Paciente elegível para doação - Acionar Banco de Olhos';
    summaryEligibility.textContent = 'Elegível';
    summaryEligibility.style.color = 'var(--success)';
    corneaLeft.classList.add('eligible');
    corneaRight.classList.add('eligible');
    corneaLeftStatus.textContent = 'Viável';
    corneaRightStatus.textContent = 'Viável';
    eligibilityReasons.hidden = true;
  }
}

/**
 * Retorna o label da contraindicação
 */
function getContraindicationLabel(value) {
  const labels = {
    hiv: 'HIV / AIDS',
    hepatite_b: 'Hepatite B',
    hepatite_c: 'Hepatite C',
    raiva: 'Raiva',
    creutzfeldt_jakob: 'Doenças Priônicas (Creutzfeldt-Jakob)',
    sepse: 'Sepse / Infecção Generalizada',
    leucemia: 'Leucemia Ativa',
    tuberculose: 'Tuberculose Ativa',
    htlv: 'HTLV I/II',
    causa_desconhecida: 'Causa de Morte Desconhecida',
    cirurgia_refrativa: 'Cirurgia Refrativa Prévia',
    ceratocone: 'Ceratocone',
    distrofia_cornea: 'Distrofia de Córnea',
    glaucoma: 'Glaucoma Avançado',
    infeccao_ocular: 'Infecção Ocular Ativa',
    tumor_ocular: 'Tumor Ocular',
    neoplasia: 'Neoplasia',
    diabetes: 'Diabetes',
    uso_drogas: 'Uso de Drogas IV',
    comportamento_risco: 'Comportamento de Risco'
  };
  return labels[value] || value;
}

/**
 * Atualiza o status do consentimento familiar
 */
function updateConsentStatus() {
  // Verificar se estamos usando radio buttons ou checkboxes
  const radioButtons = document.querySelectorAll('input[name="consentDecision"]');

  if (radioButtons.length > 0) {
    // Novo layout com radio buttons
    const selectedRadio = document.querySelector('input[name="consentDecision"]:checked');
    const consentValue = selectedRadio ? selectedRadio.value : 'pending';

    // Atualizar resumo se existir
    const summaryEligibility = document.getElementById('summary-eligibility');
    if (summaryEligibility) {
      if (consentValue === 'approved') {
        summaryEligibility.textContent = 'Autorizado';
        summaryEligibility.style.color = '#047857';
      } else if (consentValue === 'refused') {
        summaryEligibility.textContent = 'Recusado';
        summaryEligibility.style.color = '#b91c1c';
      } else {
        summaryEligibility.textContent = 'Pendente';
        summaryEligibility.style.color = '';
      }
    }
    return;
  }

  // Layout antigo com checkboxes (mantido para compatibilidade)
  const consentCheckbox = document.getElementById('family-consent');
  const refusalCheckbox = document.getElementById('family-refusal');
  const consentCard = document.getElementById('consent-status-card');

  if (!consentCard) return;

  const consentIcon = consentCard.querySelector('.consent-icon');
  const consentTitle = consentCard.querySelector('h4');
  const consentDesc = consentCard.querySelector('p');

  // Desmarcar o outro checkbox
  if (consentCheckbox && refusalCheckbox && consentCheckbox.checked && refusalCheckbox.checked) {
    if (event && event.target === consentCheckbox) {
      refusalCheckbox.checked = false;
    } else {
      consentCheckbox.checked = false;
    }
  }

  // Atualizar visual
  consentCard.style.background = '';

  if (consentCheckbox && consentCheckbox.checked) {
    consentIcon.textContent = '✅';
    consentTitle.textContent = 'Consentimento Obtido';
    consentDesc.textContent = 'Família autorizou a doação de córneas';
    consentCard.style.background = 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
  } else if (refusalCheckbox && refusalCheckbox.checked) {
    consentIcon.textContent = '❌';
    consentTitle.textContent = 'Recusa Familiar';
    consentDesc.textContent = 'Família não autorizou a doação';
    consentCard.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
  } else {
    consentIcon.textContent = '📝';
    consentTitle.textContent = 'Status do Consentimento';
    consentDesc.textContent = 'A entrevista familiar é obrigatória para autorização da doação';
  }
}

// Adicionar listeners para atualizar elegibilidade quando idade mudar
document.addEventListener('DOMContentLoaded', () => {
  const ageInput = document.getElementById('patient-age');
  if (ageInput) {
    ageInput.addEventListener('change', updateEligibility);
    ageInput.addEventListener('input', updateEligibility);
  }
});

/**
 * DoeChain - Main Application
 */

// Estado global
let currentUser = null;
let institutions = [];

// Estado da integração MV
let mvIntegrationActive = false;
let mvPollingInterval = null;
const MV_POLLING_INTERVAL = 10000; // 10 segundos

// Estado do polling de blockchain
let blockchainPollingInterval = null;
const BLOCKCHAIN_POLLING_INTERVAL = 5000; // 5 segundos

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
// Atualiza status visual quando família é comunicada
// ========================================

function updateFamilyNotifiedStatus() {
  const checkbox = document.getElementById('family-notified');
  const familyAlert = document.getElementById('family-alert');

  if (checkbox && familyAlert) {
    if (checkbox.checked) {
      // Família comunicada - reduz urgência do alerta
      familyAlert.style.opacity = '0.6';
      familyAlert.style.animation = 'none';
    } else {
      // Família ainda não comunicada - alerta ativo
      familyAlert.style.opacity = '1';
      familyAlert.style.animation = 'alertPulse 3s ease-in-out infinite';
    }
  }
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

  // Busca de notificações
  const searchInput = document.getElementById('search-notifications');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      loadNotifications();
    }, 300));
  }

  // Setup modal close on overlay click
  setupModalCloseOnOverlayClick();
}

/**
 * Debounce para evitar chamadas excessivas
 */
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
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

  // Carregar contagem de notificações não lidas
  updateUnreadBadge();

  // Inicializar integração MV
  initMVIntegration();

  // Iniciar polling de blockchain para atualizações em tempo real
  startBlockchainPolling();

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

  // Parar todos os pollings
  stopMVPolling();
  stopBlockchainPolling();

  currentUser = null;
  showLogin();
  showToast('Logout realizado', 'info');
}

// ========================================
// Dashboard
// ========================================

// Variáveis globais para os gráficos
let chartSource = null;
let chartStatus = null;
let chartConsent = null;

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

    // Load statistics (agora com KPIs completos)
    const stats = await api.getStatistics();

    // Métricas básicas
    document.getElementById('stat-total').textContent = stats.total || 0;
    document.getElementById('stat-viable').textContent = stats.corneaViable || 0;
    document.getElementById('stat-pending').textContent = stats.pending || 0;
    document.getElementById('stat-blockchain').textContent = stats.blockchainConfirmed || 0;

    // KPIs do Edital - Automação
    document.getElementById('kpi-automation-rate').textContent = `${stats.automaticRate || 0}%`;
    document.getElementById('kpi-automatic').textContent = stats.automatic || 0;
    document.getElementById('kpi-manual').textContent = stats.manual || 0;
    document.getElementById('kpi-automation-bar').style.width = `${stats.automaticRate || 0}%`;

    // KPIs do Edital - Tempo Médio
    const avgTime = stats.avgTimeToNotification;
    if (avgTime !== null && avgTime !== undefined) {
      if (avgTime < 60) {
        document.getElementById('kpi-avg-time').textContent = `${avgTime} min`;
      } else {
        const hours = Math.floor(avgTime / 60);
        const mins = avgTime % 60;
        document.getElementById('kpi-avg-time').textContent = `${hours}h ${mins}m`;
      }
    } else {
      document.getElementById('kpi-avg-time').textContent = '--';
    }

    // KPIs do Edital - Consentimento
    document.getElementById('kpi-consent-rate').textContent = `${stats.consentRate || 0}%`;
    document.getElementById('kpi-consent-yes').textContent = stats.consentGranted || 0;
    document.getElementById('kpi-consent-no').textContent = stats.consentRefused || 0;
    document.getElementById('kpi-consent-pending').textContent = stats.consentPending || 0;
    document.getElementById('kpi-consent-bar').style.width = `${stats.consentRate || 0}%`;

    // KPIs do Edital - Córneas Captadas/Transplantadas
    document.getElementById('kpi-collected').textContent = stats.corneaCollected || 0;
    document.getElementById('kpi-transplanted').textContent = stats.corneaTransplanted || 0;

    // Alerta de Urgência
    const urgentAlert = document.getElementById('urgent-alert');
    if (stats.urgentNotifications > 0) {
      document.getElementById('urgent-count').textContent = stats.urgentNotifications;
      urgentAlert.style.display = 'flex';
    } else {
      urgentAlert.style.display = 'none';
    }

    // Renderizar gráficos
    renderCharts(stats);

    // Load recent notifications
    const notifications = await api.getNotifications({ limit: 5 });
    renderRecentNotifications(notifications);
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    showToast('Erro ao carregar dados', 'error');
  }
}

/**
 * Renderiza os gráficos do dashboard
 */
function renderCharts(stats) {
  // Destruir gráficos existentes para evitar duplicação
  if (chartSource) chartSource.destroy();
  if (chartStatus) chartStatus.destroy();
  if (chartConsent) chartConsent.destroy();

  // Cores padrão
  const colors = {
    primary: '#2563eb',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    gray: '#64748b'
  };

  // Gráfico de Pizza - Fonte das Notificações
  const sourceCtx = document.getElementById('chart-source');
  if (sourceCtx) {
    const sourceData = stats.bySource || {};
    chartSource = new Chart(sourceCtx, {
      type: 'doughnut',
      data: {
        labels: ['Manual', 'MV (Automático)', 'API'],
        datasets: [{
          data: [
            sourceData.manual || 0,
            sourceData.mv || 0,
            sourceData.api || 0
          ],
          backgroundColor: [colors.gray, colors.info, colors.primary],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 10 }
          }
        }
      }
    });
  }

  // Gráfico de Pizza - Status das Notificações
  const statusCtx = document.getElementById('chart-status');
  if (statusCtx) {
    const statusData = stats.byStatus || {};
    chartStatus = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Pendente', 'Confirmado', 'Cancelado', 'Concluído'],
        datasets: [{
          data: [
            statusData.pending || 0,
            statusData.confirmed || 0,
            statusData.cancelled || 0,
            statusData.completed || 0
          ],
          backgroundColor: [colors.warning, colors.success, colors.danger, colors.primary],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 10 }
          }
        }
      }
    });
  }

  // Gráfico de Pizza - Consentimento Familiar
  const consentCtx = document.getElementById('chart-consent');
  if (consentCtx) {
    chartConsent = new Chart(consentCtx, {
      type: 'doughnut',
      data: {
        labels: ['Autorizado', 'Recusado', 'Pendente'],
        datasets: [{
          data: [
            stats.consentGranted || 0,
            stats.consentRefused || 0,
            stats.consentPending || 0
          ],
          backgroundColor: [colors.success, colors.danger, colors.gray],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 10 }
          }
        }
      }
    });
  }
}

function renderRecentNotifications(notifications) {
  const tbody = document.getElementById('recent-notifications-body');

  if (!notifications || notifications.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma notificação encontrada</td></tr>';
    return;
  }

  tbody.innerHTML = notifications.map(n => {
    const isAutomatic = n.is_automatic || n.source === 'mv';
    const sourceIcon = isAutomatic ? '<span class="mv-badge" title="Notificação automática via MV">🤖 MV</span>' : '';
    const rowClass = isAutomatic ? 'notification-automatic' : '';

    // Badge de família comunicada
    const familyBadge = n.family_notified
      ? '<span class="badge badge-family-notified">✓ Comunicada</span>'
      : '<span class="badge badge-family-pending">⚠ Pendente</span>';

    return `
    <tr class="${rowClass}">
      <td>#${n.id} ${sourceIcon}</td>
      <td>${n.patient_name || 'Anônimo'}</td>
      <td>${formatDateTime(n.death_datetime)}</td>
      <td>${familyBadge}</td>
      <td>
        <span class="badge ${n.cornea_viable ? 'badge-success' : 'badge-default'}">
          ${n.cornea_viable ? 'Viável' : 'A avaliar'}
        </span>
      </td>
      <td>
        <span class="badge badge-${getStatusBadge(n.status)}">${getStatusLabel(n.status)}</span>
      </td>
      <td>
        <button class="btn btn-sm btn-icon" onclick="viewNotification(${n.id})" title="Visualizar detalhes">👁️</button>
      </td>
    </tr>
  `}).join('');
}

// ========================================
// Notifications
// ========================================

/**
 * Navega para a página de notificações e aplica filtro de urgentes
 */
function showUrgentNotifications() {
  // Navegar para a página de notificações
  navigateTo('notifications');

  // Aplicar filtro de urgentes
  setTimeout(() => {
    const filterSelect = document.getElementById('filter-status');
    if (filterSelect) {
      filterSelect.value = 'urgent';
      loadNotifications();
    }
  }, 100);
}

async function loadNotifications() {
  try {
    // Verificar saldo do relayer para mostrar status correto
    await checkRelayerBalance();

    const status = document.getElementById('filter-status')?.value;
    const searchTerm = document.getElementById('search-notifications')?.value?.trim() || '';

    // Construir filtros
    let filters = { limit: 100 };

    // Se filtro for "urgent", buscar apenas não notificadas
    if (status === 'urgent') {
      filters.familyNotified = false;
    } else if (status) {
      filters.status = status;
    }

    // Adicionar termo de busca
    if (searchTerm) {
      filters.search = searchTerm;
    }

    let notifications = await api.getNotifications(filters);

    // Filtrar localmente se busca não for suportada pelo backend
    if (searchTerm && notifications.length > 0) {
      const term = searchTerm.toLowerCase();
      notifications = notifications.filter(n =>
        (n.patient_name && n.patient_name.toLowerCase().includes(term)) ||
        (n.institution_name && n.institution_name.toLowerCase().includes(term)) ||
        (n.id && n.id.toString().includes(term)) ||
        (n.patient_hash && n.patient_hash.toLowerCase().includes(term))
      );
    }

    renderNotificationsList(notifications);

    // Atualizar badge de não lidos
    updateUnreadBadge();
  } catch (error) {
    console.error('Erro ao carregar notificações:', error);
    showToast('Erro ao carregar notificações', 'error');
  }
}

// Função para atualizar o badge de notificações não lidas
async function updateUnreadBadge() {
  try {
    const result = await api.getUnreadCount();
    const badge = document.getElementById('unread-count-badge');
    if (badge) {
      if (result.unreadCount > 0) {
        badge.textContent = result.unreadCount > 99 ? '99+' : result.unreadCount;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Erro ao buscar contagem de não lidos:', error);
  }
}

// Função para marcar todas como lidas
async function markAllNotificationsAsRead() {
  try {
    await api.markAllAsRead();
    showToast('Todas as notificações foram marcadas como lidas', 'success');
    loadNotifications();
  } catch (error) {
    showToast('Erro ao marcar notificações como lidas', 'error');
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
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Nenhuma notificação encontrada</td></tr>';
    return;
  }

  tbody.innerHTML = notifications.map(n => {
    // Classe especial para notificações automáticas
    const isAutomatic = n.is_automatic || n.source === 'mv';
    const isUnread = !n.is_read;

    let rowClasses = [];
    if (isAutomatic) rowClasses.push('notification-automatic');
    if (isUnread) rowClasses.push('notification-unread');

    const rowClass = rowClasses.join(' ');
    const sourceIcon = isAutomatic ? '<span class="mv-badge" title="Notificação automática via MV">🤖 MV</span>' : '';
    const unreadIcon = isUnread ? '<span class="unread-badge" title="Não lida">●</span>' : '';

    return `
    <tr class="${rowClass}" data-notification-id="${n.id}">
      <td>#${n.id} ${sourceIcon} ${unreadIcon}</td>
      <td title="Hash: ${n.patient_hash || ''}">${n.patient_name || 'Não informado'}</td>
      <td>${formatDateTime(n.death_datetime)}</td>
      <td>${n.institution_name || '-'}</td>
      <td>${getConsentLabel(n.family_consent)}</td>
      <td><span class="badge badge-${getCorneaBadge(n.cornea_left_status)}">${getCorneaLabel(n.cornea_left_status)}</span></td>
      <td><span class="badge badge-${getCorneaBadge(n.cornea_right_status)}">${getCorneaLabel(n.cornea_right_status)}</span></td>
      <td>${getBlockchainStatusHtml(n)}</td>
      <td>
        <button class="btn btn-sm btn-icon" onclick="viewNotification(${n.id})" title="Visualizar detalhes">👁️</button>
      </td>
    </tr>
  `}).join('');
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

  // Obter valor do consentimento familiar
  const consentDecision = form.consentDecision?.value;
  let familyConsent = null;
  if (consentDecision === 'approved') {
    familyConsent = true;
  } else if (consentDecision === 'refused') {
    familyConsent = false;
  }

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
    // Campos de elegibilidade
    contraindications: [...contraindications, ...contraindicationsOcular, ...contraindicationsEvaluate],
    // Consentimento familiar
    familyContact: form.familyContact?.value || null,
    familyPhone: form.familyPhone?.value || null,
    familyRelationship: form.familyRelationship?.value || null,
    familyConsent: familyConsent,
    // Campo crítico do edital: família já foi comunicada
    familyNotified: form.familyNotified?.checked || false
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

    // Marcar como lida
    if (!notification.is_read) {
      try {
        await api.markAsRead(id);
        // Atualizar a lista para remover o indicador de não lido
        updateUnreadBadge();
        // Atualizar o item na lista se visível
        const listItem = document.querySelector(`[data-notification-id="${id}"]`);
        if (listItem) {
          listItem.classList.remove('notification-unread');
        }
      } catch (e) {
        console.error('Erro ao marcar como lida:', e);
      }
    }

    // Preencher dados do modal
    document.getElementById('detail-notification-id').textContent = `#${notification.id}`;
    document.getElementById('detail-patient-name').textContent = notification.patient_name || 'Não informado';
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

    // Painel de Ações de Córnea (só mostra se córnea for viável)
    const corneaActionsSection = document.getElementById('cornea-actions-section');
    if (notification.cornea_viable && corneaActionsSection) {
      corneaActionsSection.style.display = 'block';

      // Atualizar estado dos botões baseado no status atual
      const btnEvaluated = document.getElementById('btn-cornea-evaluated');
      const btnCollected = document.getElementById('btn-cornea-collected');
      const btnTransplanted = document.getElementById('btn-cornea-transplanted');

      const isEvaluated = notification.evaluation_datetime;
      const isCollected = notification.cornea_left_collected || notification.cornea_right_collected;
      const isTransplanted = notification.cornea_left_transplanted || notification.cornea_right_transplanted;

      if (btnEvaluated) {
        btnEvaluated.disabled = isEvaluated;
        btnEvaluated.innerHTML = isEvaluated ? '✅ Avaliada' : '✅ Marcar Avaliada';
      }
      if (btnCollected) {
        btnCollected.disabled = isCollected || !isEvaluated;
        btnCollected.innerHTML = isCollected ? '🔬 Coletada' : '🔬 Marcar Coletada';
      }
      if (btnTransplanted) {
        btnTransplanted.disabled = isTransplanted || !isCollected;
        btnTransplanted.innerHTML = isTransplanted ? '🎯 Transplantada' : '🎯 Marcar Transplantada';
      }

      // Renderizar timeline
      renderCorneaTimeline(notification);
    } else if (corneaActionsSection) {
      corneaActionsSection.style.display = 'none';
    }

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

/**
 * Renderiza timeline de status da córnea
 */
function renderCorneaTimeline(notification) {
  const timeline = document.getElementById('cornea-timeline');
  if (!timeline) return;

  const isEvaluated = notification.evaluation_datetime;
  const isCollected = notification.cornea_left_collected || notification.cornea_right_collected;
  const isTransplanted = notification.cornea_left_transplanted || notification.cornea_right_transplanted;

  timeline.innerHTML = `
    <span class="timeline-item ${isEvaluated ? 'completed' : ''}">
      📋 Avaliação
    </span>
    <span class="timeline-connector ${isEvaluated ? 'completed' : ''}"></span>
    <span class="timeline-item ${isCollected ? 'completed' : ''}">
      🔬 Coleta
    </span>
    <span class="timeline-connector ${isCollected ? 'completed' : ''}"></span>
    <span class="timeline-item ${isTransplanted ? 'completed' : ''}">
      🎯 Transplante
    </span>
  `;
}

/**
 * Atualiza status de ação da córnea
 */
async function updateCorneaAction(action) {
  if (!currentNotificationId) return;

  try {
    showToast(`Atualizando status para ${action}...`, 'info');

    const result = await api.updateCorneaStatus(currentNotificationId, action, 'both');

    showToast('✅ Status atualizado com sucesso!', 'success');

    // Recarregar modal com dados atualizados
    await viewNotification(currentNotificationId);

    // Atualizar dashboard
    loadDashboard();
  } catch (error) {
    console.error('Erro ao atualizar status da córnea:', error);
    showToast(error.message || 'Erro ao atualizar status', 'error');
  }
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
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhuma instituição cadastrada</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(i => `
    <tr class="institution-row" data-institution-id="${i.id}">
      <td class="toggle-cell">
        <button class="btn-toggle-operators" onclick="toggleOperatorsAccordion(${i.id}, '${i.name.replace(/'/g, "\\'")}')">
          <span class="toggle-icon">▶</span>
        </button>
      </td>
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
    <tr class="operators-accordion-row" id="operators-row-${i.id}" style="display: none;">
      <td colspan="8">
        <div class="operators-accordion-content" id="operators-content-${i.id}">
          <div class="operators-accordion-header">
            <h4>👥 Operadores</h4>
            <button class="btn btn-primary btn-sm" onclick="showAddOperatorModal(${i.id}, '${i.name.replace(/'/g, "\\'")}')">
              + Novo Operador
            </button>
          </div>
          <div class="operators-list" id="operators-list-${i.id}">
            <div class="loading-text">Carregando operadores...</div>
          </div>
        </div>
      </td>
    </tr>
  `).join('');

  // Abrir o acordeon da primeira instituição automaticamente, se houver
  if (data.length > 0) {
    // Pequeno atraso para garantir que o DOM recebeu o conteúdo
    setTimeout(() => {
      try {
        toggleOperatorsAccordion(data[0].id, data[0].name);
      } catch (e) {
        console.warn('Erro ao abrir acordeon automaticamente:', e);
      }
    }, 0);
  }
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
// Users (Operadores dentro de Instituições - Acordeon)
// ========================================

// Instituição atual selecionada para gerenciar operadores
let currentInstitutionId = null;
let currentInstitutionName = '';
let openAccordionId = null;

async function toggleOperatorsAccordion(institutionId, institutionName) {
  const row = document.getElementById(`operators-row-${institutionId}`);
  const toggleBtn = document.querySelector(`tr[data-institution-id="${institutionId}"] .toggle-icon`);

  // Se já está aberto, fechar
  if (openAccordionId === institutionId) {
    row.style.display = 'none';
    toggleBtn.textContent = '▶';
    toggleBtn.classList.remove('open');
    openAccordionId = null;
    return;
  }

  // Fechar acordeon anterior se houver
  if (openAccordionId !== null) {
    const prevRow = document.getElementById(`operators-row-${openAccordionId}`);
    const prevToggle = document.querySelector(`tr[data-institution-id="${openAccordionId}"] .toggle-icon`);
    if (prevRow) prevRow.style.display = 'none';
    if (prevToggle) {
      prevToggle.textContent = '▶';
      prevToggle.classList.remove('open');
    }
  }

  // Abrir novo acordeon
  currentInstitutionId = institutionId;
  currentInstitutionName = institutionName;
  openAccordionId = institutionId;

  row.style.display = 'table-row';
  toggleBtn.textContent = '▼';
  toggleBtn.classList.add('open');

  // Carregar operadores
  await loadOperatorsForAccordion(institutionId);
}

async function loadOperatorsForAccordion(institutionId) {
  const container = document.getElementById(`operators-list-${institutionId}`);
  container.innerHTML = '<div class="loading-text">Carregando operadores...</div>';

  try {
    const users = await api.getUsers({ institutionId });
    renderOperatorsInAccordion(institutionId, users);
  } catch (error) {
    console.error('Erro ao carregar operadores:', error);
    container.innerHTML = '<div class="empty-state text-danger">Erro ao carregar operadores</div>';
  }
}

function renderOperatorsInAccordion(institutionId, users) {
  const container = document.getElementById(`operators-list-${institutionId}`);

  if (!users || users.length === 0) {
    container.innerHTML = '<div class="empty-state">Nenhum operador cadastrado nesta instituição</div>';
    return;
  }

  container.innerHTML = `
    <table class="data-table operators-table">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Email</th>
          <th>Status</th>
          <th>Último Login</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td><span class="badge badge-${u.active ? 'success' : 'danger'}">${u.active ? 'Ativo' : 'Inativo'}</span></td>
            <td>${u.last_login ? formatDateTime(u.last_login) : 'Nunca'}</td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="toggleUserStatus(${u.id}, ${u.active})">${u.active ? 'Desativar' : 'Ativar'}</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function showAddOperatorModal(institutionId, institutionName) {
  // Preencher dados da instituição
  currentInstitutionId = institutionId || currentInstitutionId;
  currentInstitutionName = institutionName || currentInstitutionName;

  document.getElementById('user-institution-id').value = currentInstitutionId;
  document.getElementById('user-institution-name').value = currentInstitutionName;

  // Limpar outros campos
  document.getElementById('user-name').value = '';
  document.getElementById('user-email').value = '';
  document.getElementById('user-password').value = '';
  // campo de função removido do modal; frontend enviará role = 'admin' temporariamente

  showModal('user-modal');
}

async function handleUserSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const institutionId = document.getElementById('user-institution-id').value;

  // Validar instituição obrigatória
  if (!institutionId) {
    showToast('Instituição não selecionada', 'error');
    return;
  }

  const data = {
    name: form.name.value,
    email: form.email.value,
    password: form.password.value,
    role: 'admin',
    institutionId: parseInt(institutionId)
  };

  try {
    await api.createUser(data);
    hideModal('user-modal');
    form.reset();
    showToast('Operador criado com sucesso!', 'success');

    // Recarregar lista de operadores no acordeon
    if (currentInstitutionId) {
      await loadOperatorsForAccordion(currentInstitutionId);
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function toggleUserStatus(userId, currentActive) {
  const action = currentActive ? 'desativar' : 'ativar';
  if (!confirm(`Deseja ${action} este operador?`)) return;

  try {
    await api.updateUser(userId, { active: !currentActive });
    showToast(`Operador ${currentActive ? 'desativado' : 'ativado'} com sucesso!`, 'success');

    // Recarregar lista no acordeon
    if (currentInstitutionId) {
      await loadOperatorsForAccordion(currentInstitutionId);
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function editUser(id) {
  showToast(`Editar operador #${id}`, 'info');
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
      <td title="${tx.tx_hash || '-'}">${tx.tx_hash ? `<a href="https://sepolia.etherscan.io/tx/${tx.tx_hash}" target="_blank" class="tx-link">${tx.tx_hash.substring(0, 10)}...</a>` : '-'}</td>
      <td>${tx.tx_type}</td>
      <td><span class="badge badge-${tx.status === 'confirmed' ? 'success' : tx.status === 'failed' ? 'danger' : 'warning'}">${tx.status}</span></td>
      <td>${formatDateTime(tx.created_at)}</td>
    </tr>
  `).join('');
}

// ========================================
// Integração MV (Mock API)
// ========================================

/**
 * Inicializa o status da integração MV
 */
async function initMVIntegration() {
  try {
    const status = await api.getMVStatus();
    mvIntegrationActive = status.active;
    updateMVToggleButton();

    if (mvIntegrationActive) {
      startMVPolling();
    }
  } catch (error) {
    console.error('Erro ao verificar status MV:', error);
  }
}

/**
 * Atualiza o botão de toggle da integração MV
 */
function updateMVToggleButton() {
  const btn = document.getElementById('mv-toggle-btn');
  if (!btn) return;

  if (mvIntegrationActive) {
    btn.innerHTML = '🔴 Desligar MV';
    btn.classList.add('mv-active');
    btn.classList.remove('mv-inactive');
  } else {
    btn.innerHTML = '🟢 Ligar MV';
    btn.classList.remove('mv-active');
    btn.classList.add('mv-inactive');
  }
}

/**
 * Toggle da integração MV
 */
async function toggleMVIntegration() {
  const btn = document.getElementById('mv-toggle-btn');

  try {
    btn.disabled = true;
    btn.innerHTML = '⏳ Processando...';

    const newState = !mvIntegrationActive;
    const result = await api.toggleMVIntegration(newState);

    mvIntegrationActive = result.active;
    updateMVToggleButton();

    if (mvIntegrationActive) {
      startMVPolling();
      showToast('🤖 Integração MV ativada! Novos óbitos serão importados automaticamente.', 'success');
    } else {
      stopMVPolling();
      showToast('⏹️ Integração MV desativada.', 'info');
    }
  } catch (error) {
    console.error('Erro ao alternar MV:', error);
    showToast('Erro ao alternar integração MV: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    updateMVToggleButton();
  }
}

/**
 * Inicia o polling da API MV
 */
function startMVPolling() {
  if (mvPollingInterval) {
    clearInterval(mvPollingInterval);
  }

  console.log('[MV] Iniciando polling a cada', MV_POLLING_INTERVAL / 1000, 'segundos');

  // Executa imediatamente uma vez
  pollMVDeaths();

  // Configura intervalo
  mvPollingInterval = setInterval(pollMVDeaths, MV_POLLING_INTERVAL);
}

/**
 * Para o polling da API MV
 */
function stopMVPolling() {
  if (mvPollingInterval) {
    clearInterval(mvPollingInterval);
    mvPollingInterval = null;
    console.log('[MV] Polling parado');
  }
}

// ========================================
// Blockchain Polling - Atualização em Tempo Real
// ========================================

/**
 * Inicia o polling para verificar status de transações blockchain
 */
function startBlockchainPolling() {
  if (blockchainPollingInterval) {
    clearInterval(blockchainPollingInterval);
  }

  console.log('[Blockchain] Iniciando polling a cada', BLOCKCHAIN_POLLING_INTERVAL / 1000, 'segundos');

  // Executa imediatamente uma vez
  checkBlockchainUpdates();

  // Configura intervalo
  blockchainPollingInterval = setInterval(checkBlockchainUpdates, BLOCKCHAIN_POLLING_INTERVAL);
}

/**
 * Para o polling de blockchain
 */
function stopBlockchainPolling() {
  if (blockchainPollingInterval) {
    clearInterval(blockchainPollingInterval);
    blockchainPollingInterval = null;
    console.log('[Blockchain] Polling parado');
  }
}

/**
 * Verifica atualizações de transações blockchain pendentes
 */
async function checkBlockchainUpdates() {
  try {
    const result = await api.checkBlockchainStatus();

    if (result.updated && result.updated.length > 0) {
      console.log(`[Blockchain] ${result.updated.length} transação(ões) atualizada(s)`);

      // Mostrar toast para cada transação confirmada
      result.updated.forEach(tx => {
        if (tx.status === 'confirmed') {
          showToast(`✅ Notificação #${tx.id} confirmada na blockchain (bloco ${tx.blockNumber})`, 'success');
        } else if (tx.status === 'failed') {
          showToast(`❌ Transação da notificação #${tx.id} falhou`, 'error');
        }
      });

      // Atualizar lista de notificações se estiver na página
      const currentPage = document.querySelector('.nav-item.active')?.dataset?.page;
      if (currentPage === 'notifications' || currentPage === 'dashboard') {
        loadNotifications();
        loadDashboard();
      }
    }
  } catch (error) {
    // Silenciar erros de polling para não poluir o console
    if (!error.message?.includes('401')) {
      console.error('[Blockchain] Erro no polling:', error.message);
    }
  }
}

/**
 * Executa polling para buscar novos óbitos da MV
 */
async function pollMVDeaths() {
  if (!mvIntegrationActive) return;

  try {
    const result = await api.pollMVDeaths();

    if (result.count > 0) {
      console.log(`[MV] ${result.count} nova(s) notificação(ões) importada(s)`);

      // Mostrar toast para cada nova notificação
      result.notifications.forEach(n => {
        showMVNotificationToast(n);
      });

      // Atualizar lista de notificações se estiver na página
      const currentPage = document.querySelector('.nav-item.active')?.dataset?.page;
      if (currentPage === 'notifications' || currentPage === 'dashboard') {
        loadNotifications();
        loadDashboard();
      }
    }
  } catch (error) {
    console.error('[MV] Erro no polling:', error);
  }
}

/**
 * Exibe toast especial para notificações MV
 */
function showMVNotificationToast(notification) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-mv';
  toast.innerHTML = `
    <div class="toast-mv-header">
      <span class="mv-icon">🤖</span>
      <strong>Nova Notificação MV</strong>
    </div>
    <div class="toast-mv-body">
      <span>ID: #${notification.id}</span>
      <span>${notification.institution_name || 'Hospital'}</span>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/**
 * Força geração de um óbito MV (para testes)
 */
async function forceGenerateMVDeath() {
  try {
    showToast('⏳ Gerando óbito simulado...', 'info');
    const result = await api.forceGenerateMVDeath();

    showToast(`✅ Óbito gerado: #${result.notification.id}`, 'success');

    // Atualizar lista
    const currentPage = document.querySelector('.nav-item.active')?.dataset?.page;
    if (currentPage === 'notifications' || currentPage === 'dashboard') {
      loadNotifications();
      loadDashboard();
    }
  } catch (error) {
    console.error('Erro ao gerar óbito:', error);
    showToast('Erro ao gerar óbito: ' + error.message, 'error');
  }
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

function getConsentLabel(consent) {
  if (consent === 1 || consent === true) {
    return '✅ Sim';
  } else if (consent === 0 || consent === false) {
    return '❌ Não';
  }
  return '⏳ Aguardando';
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

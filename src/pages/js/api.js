/**
 * API Client - Comunicação com o backend
 */

const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken() {
    return this.token || localStorage.getItem('token');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.getToken()) {
      headers['Authorization'] = `Bearer ${this.getToken()}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        // Se receber 401 (não autorizado), limpar token e redirecionar para login
        if (response.status === 401) {
          this.setToken(null);
          // Disparar evento customizado para que a aplicação possa reagir
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        throw new Error(data.error || data.message || 'Erro na requisição');
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // ========================================
  // Auth
  // ========================================

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(data.token);
    return data;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async changePassword(oldPassword, newPassword) {
    return this.request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword })
    });
  }

  // ========================================
  // Users
  // ========================================

  async getUsers(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/auth/users?${params}`);
  }

  async createUser(userData) {
    return this.request('/auth/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async updateUser(id, userData) {
    return this.request(`/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  }

  // ========================================
  // Notifications
  // ========================================

  async getNotifications(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/notifications?${params}`);
  }

  async getNotification(id) {
    return this.request(`/notifications/${id}`);
  }

  async createNotification(data) {
    return this.request('/notifications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateCorneaStatus(id, leftStatus, rightStatus) {
    return this.request(`/notifications/${id}/cornea`, {
      method: 'PUT',
      body: JSON.stringify({ leftStatus, rightStatus })
    });
  }

  async registerConsent(id, consent, consentBy) {
    return this.request(`/notifications/${id}/consent`, {
      method: 'PUT',
      body: JSON.stringify({ consent, consentBy })
    });
  }

  async submitToBlockchain(id) {
    return this.request(`/notifications/${id}/blockchain`, {
      method: 'POST'
    });
  }

  async getStatistics() {
    return this.request('/notifications/statistics');
  }

  async markAsRead(id) {
    return this.request(`/notifications/${id}/read`, {
      method: 'PUT'
    });
  }

  async markAllAsRead() {
    return this.request('/notifications/mark-all-read', {
      method: 'POST'
    });
  }

  async getUnreadCount() {
    return this.request('/notifications/unread-count');
  }

  async checkBlockchainStatus() {
    return this.request('/notifications/check-blockchain');
  }

  // ========================================
  // Institutions
  // ========================================

  async getInstitutions(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/institutions?${params}`);
  }

  async getInstitution(id) {
    return this.request(`/institutions/${id}`);
  }

  async createInstitution(data) {
    return this.request('/institutions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateInstitution(id, data) {
    return this.request(`/institutions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async getInstitutionTypes() {
    return this.request('/institutions/types');
  }

  // ========================================
  // Relayer
  // ========================================

  async getRelayerStatus() {
    return this.request('/relay/status');
  }

  async getRelayerBalance() {
    return this.request('/relay/balance');
  }

  async getRelayerTransactions(limit = 50) {
    return this.request(`/relay/transactions?limit=${limit}`);
  }

  async getRelayerBalanceHistory(limit = 30) {
    return this.request(`/relay/balance-history?limit=${limit}`);
  }

  // ========================================
  // Integração MV
  // ========================================

  async getMVStatus() {
    return this.request('/mv/status');
  }

  async toggleMVIntegration(active) {
    return this.request('/mv/toggle', {
      method: 'POST',
      body: JSON.stringify({ active })
    });
  }

  async pollMVDeaths() {
    return this.request('/mv/poll');
  }

  async forceGenerateMVDeath() {
    return this.request('/mv/force-generate', {
      method: 'POST'
    });
  }

  async getMVDeaths(hours = null) {
    const params = hours ? `?hours=${hours}` : '';
    return this.request(`/mv/deaths${params}`);
  }

  // ========================================
  // Health
  // ========================================

  async healthCheck() {
    return this.request('/health');
  }
}

// Singleton
const api = new ApiClient();

// REST API Service for Vehicle Service and Maintenance Prediction Platform

const API_BASE_URL = (window.location.origin.startsWith('http://localhost') || window.location.origin.startsWith('http://127.0.0.1'))
    && !window.location.port.includes('5500') && !window.location.port.includes('3000')
    ? window.location.origin
    : 'http://localhost:8080';

const Api = {
  baseUrl: API_BASE_URL,

  getToken() {
    return localStorage.getItem('auth_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('auth_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('auth_user');
    }
  },

  logout() {
    this.setToken(null);
    this.setCurrentUser(null);
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // Token expired or invalid
        console.warn('Unauthorized request, clearing session');
        this.logout();
        window.dispatchEvent(new CustomEvent('auth:expired'));
        throw new Error('Session expired. Please log in again.');
      }

      if (response.status === 204) {
        return null;
      }

      const contentType = response.headers.get('content-type');
      let data = null;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorMsg = (data && data.message) ? data.message : (typeof data === 'string' && data ? data : response.statusText);
        throw new Error(errorMsg || `HTTP error ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  },

  // Auth Endpoints
  auth: {
    login: (credentials) => Api.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),
    register: (userData) => Api.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
    me: () => Api.request('/api/auth/me')
  },

  // Vehicle Management Endpoints
  vehicles: {
    getAll: () => Api.request('/api/vehicles'),
    getById: (id) => Api.request(`/api/vehicles/${id}`),
    create: (data) => Api.request('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => Api.request(`/api/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    updateMileage: (id, mileage) => Api.request(`/api/vehicles/${id}/mileage`, {
      method: 'PATCH',
      body: JSON.stringify({ mileage: parseInt(mileage, 10) })
    }),
    delete: (id) => Api.request(`/api/vehicles/${id}`, {
      method: 'DELETE'
    })
  },

  // Predictive Maintenance Endpoints
  predictions: {
    getForVehicle: (vehicleId) => Api.request(`/api/predictions/vehicle/${vehicleId}`),
    getAllMyVehicles: () => Api.request('/api/predictions/all-my-vehicles')
  },

  // Service Booking Endpoints
  bookings: {
    getAll: () => Api.request('/api/bookings'),
    getById: (id) => Api.request(`/api/bookings/${id}`),
    create: (data) => Api.request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    cancel: (id) => Api.request(`/api/bookings/${id}/cancel`, {
      method: 'PUT'
    }),
    updateStatus: (id, statusData) => Api.request(`/api/bookings/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(statusData)
    })
  },

  // Historical Records Endpoints
  records: {
    getAll: () => Api.request('/api/records'),
    getByVehicle: (vehicleId) => Api.request(`/api/records/vehicle/${vehicleId}`),
    create: (data) => Api.request('/api/records', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    delete: (id) => Api.request(`/api/records/${id}`, {
      method: 'DELETE'
    })
  },

  // Cost Reports Endpoints
  reports: {
    getCostSummary: () => Api.request('/api/reports/cost-summary'),
    getVehicleReport: (vehicleId) => Api.request(`/api/reports/vehicle/${vehicleId}`),
    getFleetReport: () => Api.request('/api/reports/fleet')
  },

  // Notifications & Reminders Endpoints
  notifications: {
    getAll: () => Api.request('/api/notifications'),
    getUnreadCount: () => Api.request('/api/notifications/unread-count'),
    markAsRead: (id) => Api.request(`/api/notifications/${id}/read`, { method: 'PUT' }),
    markAllAsRead: () => Api.request('/api/notifications/read-all', { method: 'PUT' })
  },

  // Admin Control Center Endpoints
  admin: {
    getDashboard: () => Api.request('/api/admin/dashboard'),
    getUsers: () => Api.request('/api/admin/users'),
    updateRole: (userId, role) => Api.request(`/api/admin/users/${userId}/role?role=${role}`, { method: 'PUT' }),
    getFleetHealth: () => Api.request('/api/admin/fleet-health')
  }
};

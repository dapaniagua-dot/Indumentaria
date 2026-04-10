// Local API client with JWT authentication
const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function handleAuthError(res) {
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('token');
    window.location.reload();
  }
}

function createEntityClient(entityName) {
  return {
    async list(sort, limit) {
      const params = new URLSearchParams();
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      const res = await fetch(`${API_BASE}/entities/${entityName}?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) { handleAuthError(res); throw new Error(`list ${entityName} failed`); }
      return res.json();
    },

    async filter(filters) {
      const res = await fetch(`${API_BASE}/entities/${entityName}/filter`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(filters),
      });
      if (!res.ok) { handleAuthError(res); throw new Error(`filter ${entityName} failed`); }
      return res.json();
    },

    async create(data) {
      const res = await fetch(`${API_BASE}/entities/${entityName}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) { handleAuthError(res); throw new Error(`create ${entityName} failed`); }
      return res.json();
    },

    async update(id, data) {
      const res = await fetch(`${API_BASE}/entities/${entityName}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) { handleAuthError(res); throw new Error(`update ${entityName} failed`); }
      return res.json();
    },

    async delete(id) {
      const res = await fetch(`${API_BASE}/entities/${entityName}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) { handleAuthError(res); throw new Error(`delete ${entityName} failed`); }
      return res.json();
    },
  };
}

export const base44 = {
  entities: {
    Product: createEntityClient('Product'),
    StockMovement: createEntityClient('StockMovement'),
    Entrega: createEntityClient('Entrega'),
  },
  integrations: {
    Core: {
      async UploadFile({ file }) {
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          body: formData,
        });
        if (!res.ok) { handleAuthError(res); throw new Error('Upload failed'); }
        return res.json();
      },
    },
  },
  auth: {
    async me() {
      const res = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Auth failed');
      return res.json();
    },
    logout() {
      localStorage.removeItem('token');
      window.location.reload();
    },
    redirectToLogin() {
      localStorage.removeItem('token');
      window.location.reload();
    },
  },
};

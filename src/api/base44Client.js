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
  videoEntregas: {
    // Whether R2 video storage is configured on the server.
    async isEnabled() {
      try {
        const res = await fetch(`${API_BASE}/config/features`, { headers: getAuthHeaders() });
        if (!res.ok) return false;
        const data = await res.json();
        return !!data.videoEntregas;
      } catch {
        return false;
      }
    },
    // Trusted server time (ms epoch) for the burned-in clock.
    async serverTime() {
      const res = await fetch(`${API_BASE}/server-time`, { headers: getAuthHeaders() });
      if (!res.ok) { handleAuthError(res); throw new Error('server-time failed'); }
      return res.json();
    },
    // Get a presigned PUT URL to upload a delivery video directly to R2.
    async presign(contentType) {
      const res = await fetch(`${API_BASE}/entregas/video-presign`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ contentType }),
      });
      if (!res.ok) { handleAuthError(res); throw new Error('presign failed'); }
      return res.json();
    },
    // Upload the recorded blob to R2 via the presigned URL, reporting progress (0..1).
    upload(uploadUrl, blob, contentType, onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('upload network error'));
        xhr.send(blob);
      });
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

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message, { status, code, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

function redirectToMaintenanceIfNeeded(status, code) {
  if (typeof window === 'undefined') return;
  if (status !== 503 || code !== 'MAINTENANCE') return;
  if (window.location.pathname.startsWith('/admin')) return;
  if (window.location.pathname === '/maintenance') return;
  window.location.assign('/maintenance');
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('bakibook_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    redirectToMaintenanceIfNeeded(response.status, data.code);
    throw new ApiError(data.message || 'Something went wrong', {
      status: response.status,
      code: data.code,
      data,
    });
  }

  return data;
}

export default request;

import axios from 'axios';

// In Vercel, API routes are at /api/* — same origin, no base URL needed
const api = axios.create({ baseURL: '' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('nj_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('nj_token');
    localStorage.removeItem('nj_user');
    window.location.reload();
  }
  return Promise.reject(err);
});

export default api;

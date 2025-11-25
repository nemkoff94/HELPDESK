import axios from 'axios';

// Определяем API URL в зависимости от окружения
let API_URL = process.env.REACT_APP_API_URL;

// Если переменная окружения не установлена, определяем по текущему хосту
if (!API_URL) {
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port;
  
  // На production используем текущий хост
  if (host.includes('obs-panel.ru') || host === '46.173.29.62') {
    API_URL = `${protocol}//${host}${port ? ':' + port : ''}/api`;
  } else {
    // На локальной машине используем localhost:5001
    API_URL = 'http://localhost:5001/api';
  }
}

const api = axios.create({
  baseURL: API_URL,
});

// Добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Обработка ошибок авторизации
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;



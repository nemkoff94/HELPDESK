import axios from 'axios';

// Определяем API URL в зависимости от окружения
let API_URL = process.env.REACT_APP_API_URL;

// Если переменная окружения не установлена, определяем по текущему хосту
if (!API_URL) {
  const hostname = window.location.hostname;
  
  // На локальной машине используем localhost:5001
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    API_URL = 'http://localhost:5001/api';
  } else {
    // На production используем текущий хост
    const protocol = window.location.protocol;
    API_URL = `${protocol}//${hostname}/api`;
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
    const status = error.response?.status;
    const reqUrl = error.config?.url || '';
    // Не выполняем автоматический редирект на /login для самих auth-запросов
    const skipAuthRedirect = ['/auth/login', '/auth/client-login', '/auth/me'].some((u) => reqUrl.includes(u));

    if ((status === 401 || status === 403) && !skipAuthRedirect) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

export const getFileUrl = (path) => {
  if (!path) return '';
  const FILES_HOST = process.env.REACT_APP_FILES_HOST;
  if (FILES_HOST) {
    return `${FILES_HOST}${path}`;
  }
  const hostname = window.location.hostname;
  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://localhost:5001${path}`;
  }
  // Default production file host
  return `https://obs-panel.ru${path}`;
};



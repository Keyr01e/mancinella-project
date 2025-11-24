// Конфигурация API URL

export function getApiUrl() {
  // 1. Если задана переменная окружения (из Dockerfile) - используем её.
  // В нашем CI/CD мы передавали VITE_API_URL=/api
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // 2. Фолбэк для локальной разработки (если переменной нет)
  // Если мы на localhost, то стучимся на 8000.
  // Если мы на реальном домене, то используем относительный путь /api
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000';
  }

  // Для продакшена возвращаем просто префикс, браузер сам подставит домен
  return '/api';
}

// Специальная функция для Вебсокетов
export function getWsUrl() {
  // Определяем протокол: если https -> то wss, иначе ws
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host; // mancinella.ru (без порта, или с портом если есть)
  
  // Если мы локально, то хардкодим порт бэка
  if (window.location.hostname === 'localhost') {
      return 'ws://localhost:8000';
  }

  // В продакшене идем через Nginx по пути /api
  // Nginx сам проксирует это на бэкенд
  return `${protocol}//${host}/api`; 
}

export const API_URL = getApiUrl();
export const WS_URL = getWsUrl();

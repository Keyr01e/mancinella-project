// Конфигурация API URL
// Автоматически определяет хост для работы в локальной сети

export function getApiUrl() {
  // Если задана переменная окружения - используем её
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Иначе используем текущий хост
  const protocol = window.location.protocol; // http: или https:
  const host = window.location.hostname; // localhost или IP адрес
  return `${protocol}//${host}:8000`;
}

export const API_URL = getApiUrl();

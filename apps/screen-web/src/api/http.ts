import axios from 'axios';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  timeout: 12000,
});

let token = localStorage.getItem('screen_token') ?? '';

export function setToken(value: string) {
  token = value;
  localStorage.setItem('screen_token', value);
}

http.interceptors.request.use((config) => {
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use((response) => response.data.data);

export async function screenLogin() {
  if (token) return;
  const result = (await http.post('/auth/login', {
    username: import.meta.env.VITE_SCREEN_USERNAME ?? 'admin',
    password: import.meta.env.VITE_SCREEN_PASSWORD ?? 'admin123456',
  })) as any;
  setToken(result.accessToken);
}

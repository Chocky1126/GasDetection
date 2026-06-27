import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { http } from '../api/http';

interface LoginResponse {
  accessToken: string;
  user: {
    username: string;
    name: string;
    roles: string[];
    permissions: string[];
  };
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('admin_token') ?? '');
  const user = ref<LoginResponse['user'] | null>(null);
  const isAuthenticated = computed(() => Boolean(token.value));

  async function login(username: string, password: string) {
    const result = (await http.post('/auth/login', { username, password })) as unknown as LoginResponse;
    token.value = result.accessToken;
    user.value = result.user;
    localStorage.setItem('admin_token', result.accessToken);
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('admin_token');
  }

  return { token, user, isAuthenticated, login, logout };
});

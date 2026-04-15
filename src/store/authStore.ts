import { create } from 'zustand';
import type { User } from '../types';  // ← ADD THIS


interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  // Called after login/signup success
  setAuth: (user, token) => {
    // Save to localStorage
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    set({ user, token, isAuthenticated: true });
  },

  // Called on logout
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  // Called on app load — restore session from localStorage
  loadFromStorage: () => {
    const token   = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({ user, token, isAuthenticated: true });
      } catch {
        // Corrupted data — clear it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  },
}));

import axios from 'axios';
import type { ApiResponse, AuthResponse, LoginPayload, SignupPayload } from '../types';


// ============================================
// MOCK MODE — Remove this when backend is ready
// ============================================
const MOCK_MODE = true;

// ============================================
// MOCK USERS — Admin + Test User (pre-seeded)
// ============================================
export const MOCK_USERS = [
  {
    id       : 'admin_001',
    name     : 'Admin',
    email    : 'admin@test.com',
    password : 'admin123',
    role     : 'admin' as const,
    createdAt              : new Date().toISOString(),
    assignedTemplateId     : null,
    assignedTemplateName   : null,
  },
  {
    id       : 'user_001',
    name     : 'Test User',
    email    : 'user@test.com',
    password : 'user123',
    role     : 'user' as const,
    createdAt              : new Date().toISOString(),
    assignedTemplateId     : null,
    assignedTemplateName   : null,
  },
];

// ============================================
// MOCK DB — localStorage helpers
// ============================================

// ── Get all users (pre-seeded + registered) ─
const getMockUsers = () => {
  const raw = localStorage.getItem('mock_users');
  if (raw) return JSON.parse(raw);

  // First time — seed the default users
  saveMockUsers(MOCK_USERS);
  return MOCK_USERS;
};

const saveMockUsers = (users: any[]) => {
  localStorage.setItem('mock_users', JSON.stringify(users));
};

// ── Mock Signup ────────────────────────────────────
const mockSignup = (payload: SignupPayload): AuthResponse => {
  const users = getMockUsers();

  // Check if email already exists
  const exists = users.find((u: any) => u.email === payload.email);
  if (exists) {
    throw { response: { data: { message: 'Email already registered' } } };
  }

  // Create new user
  const newUser = {
    id       : `user_${Date.now()}`,
    name     : payload.name,
    email    : payload.email,
    password : payload.password,   // in real backend this would be hashed
    role     : 'user' as const,
    createdAt              : new Date().toISOString(),
    assignedTemplateId     : null,
    assignedTemplateName   : null,
  };

  // Save to mock DB
  users.push(newUser);
  saveMockUsers(users);

  // Return token + user (without password)
  const { password, ...userWithoutPassword } = newUser;
  return {
    token : `mock_token_${newUser.id}`,
    user  : userWithoutPassword,
  };
};

// ── Mock Login ─────────────────────────────────────
const mockLogin = (payload: LoginPayload): AuthResponse => {
  const users = getMockUsers();

  // Find user by email
  const user = users.find((u: any) => u.email === payload.email);

  // Wrong email
  if (!user) {
    throw { response: { data: { message: 'No account found with this email' } } };
  }

  // Wrong password
  if (user.password !== payload.password) {
    throw { response: { data: { message: 'Incorrect password' } } };
  }

  // Success — return token + user
  const { password, ...userWithoutPassword } = user;
  return {
    token : `mock_token_${user.id}`,
    user  : userWithoutPassword,
  };
};

// ============================================
// REAL API SETUP (used when MOCK_MODE = false)
// ============================================

const API_BASE = 'http://localhost:3000/api';

const api = axios.create({
  baseURL : API_BASE,
  headers : { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================================
// EXPORTED API FUNCTIONS
// ============================================

export const loginApi = async (
  payload: LoginPayload
): Promise<AuthResponse> => {
  if (MOCK_MODE) {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 800));
    return mockLogin(payload);
  }
  const response = await api.post<ApiResponse<AuthResponse>>(
    '/auth/login',
    payload
  );
  return response.data.data;
};

export const signupApi = async (
  payload: SignupPayload
): Promise<AuthResponse> => {
  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 800));
    return mockSignup(payload);
  }
  const response = await api.post<ApiResponse<AuthResponse>>(
    '/auth/signup',
    payload
  );
  return response.data.data;
};

export const getMeApi = async (): Promise<AuthResponse['user']> => {
  if (MOCK_MODE) {
    const userStr = localStorage.getItem('user');
    if (userStr) return JSON.parse(userStr);
    throw new Error('Not authenticated');
  }
  const response = await api.get<ApiResponse<AuthResponse['user']>>(
    '/auth/me'
  );
  return response.data.data;
};

export default api;

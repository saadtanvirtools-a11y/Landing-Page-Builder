import { create } from "zustand";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { User } from "../types";

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
  refreshUserFromFirestore: () => Promise<void>; // ✅ NEW
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  // ── Login / Signup ─────────────────────────────
  setAuth: (user, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));

    set({ user, token, isAuthenticated: true });
  },

  // ── Logout ─────────────────────────────────────
  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    set({ user: null, token: null, isAuthenticated: false });
  },

  // ── Load from localStorage ─────────────────────
  loadFromStorage: () => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({ user, token, isAuthenticated: true });
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
  },

  // ── 🔥 NEW: Sync user with Firestore ───────────
  refreshUserFromFirestore: async () => {
    const { user } = get();
    if (!user?.id) return;

    try {
      const snap = await getDoc(doc(db, "users", user.id));
      if (!snap.exists()) return;

      const freshUser = snap.data() as User;

      // update both state + localStorage
      localStorage.setItem("user", JSON.stringify(freshUser));
      set({ user: freshUser });

  
    } catch (err) {
    
    }
  },
}));
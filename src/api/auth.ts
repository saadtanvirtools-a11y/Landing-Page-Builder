import { collection, doc, getDocs, getDoc, setDoc, query, where, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { AuthResponse, LoginPayload, SignupPayload } from "../types";

// ─────────────────────────────────────────────────────────
// COLLECTION NAMES
// ─────────────────────────────────────────────────────────
const USERS_COL = "users";

// ─────────────────────────────────────────────────────────
// SEED ADMIN — creates admin account if it doesn't exist
// Called once on app load from main.tsx
// ─────────────────────────────────────────────────────────
export async function seedAdminIfNeeded(): Promise<void> {
  try {
    const adminRef = doc(db, USERS_COL, "admin_001");
    const snap = await getDoc(adminRef);
    if (!snap.exists()) {
      await setDoc(adminRef, {
        id: "admin_001",
        name: "Admin",
        email: "admin@test.com",
        password: "admin123",
        role: "admin",
        createdAt: new Date().toISOString(),
        assignedTemplateId: null,
        assignedTemplateName: null,
      });
      console.log("[Auth] Admin seeded to Firestore");
    }
  } catch (e) {
    console.error("[Auth] seedAdmin error:", e);
  }
}

// ─────────────────────────────────────────────────────────
// GET ALL USERS — used by admin panel
// ─────────────────────────────────────────────────────────
export async function getAllUsers(): Promise<any[]> {
  const snap = await getDocs(collection(db, USERS_COL));
  return snap.docs.map((d) => {
    const data = d.data();
    const { password, ...safe } = data;
    return safe;
  });
}

// ─────────────────────────────────────────────────────────
// CREATE USER BY ADMIN — used by admin panel
// ─────────────────────────────────────────────────────────
export async function createUserByAdmin(email: string, name: string, password: string): Promise<void> {
  // Check if email already exists
  const q = query(collection(db, USERS_COL), where("email", "==", email));
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error("Email already registered");
  }

  // Create new user
  const newUser = {
    id: `user_${Date.now()}`,
    name: name,
    email: email,
    password: password,
    role: "user" as const,
    createdAt: new Date().toISOString(),
    assignedTemplateId: null,
    assignedTemplateName: null,
  };

  await setDoc(doc(db, USERS_COL, newUser.id), newUser);
}

// ─────────────────────────────────────────────────────────
// UPDATE USER — used by AssignTemplate
// ─────────────────────────────────────────────────────────
export async function updateUserInDb(userId: string, updates: Partial<{ assignedTemplateId: string | null; assignedTemplateName: string | null }>): Promise<void> {
  const ref = doc(db, USERS_COL, userId);
  await updateDoc(ref, updates);
}


// ─────────────────────────────────────────────────────────
// DELETE USER — used by admin panel
// ─────────────────────────────────────────────────────────
import { deleteDoc } from "firebase/firestore";

export async function deleteUserByAdmin(userId: string): Promise<void> {
  try {
    const ref = doc(db, USERS_COL, userId);
    await deleteDoc(ref);
    console.log("[Auth] User deleted:", userId);
  } catch (err) {
    console.error("[Auth] deleteUser error:", err);
    throw new Error("Failed to delete user");
  }
}
// ─────────────────────────────────────────────────────────
// SIGNUP
// ─────────────────────────────────────────────────────────
export const signupApi = async (payload: SignupPayload): Promise<AuthResponse> => {
  await new Promise((r) => setTimeout(r, 400)); // simulate delay

  // Check if email already exists
  const q = query(collection(db, USERS_COL), where("email", "==", payload.email));
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw { response: { data: { message: "Email already registered" } } };
  }

  // Create new user
  const newUser = {
    id: `user_${Date.now()}`,
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: "user" as const,
    createdAt: new Date().toISOString(),
    assignedTemplateId: null,
    assignedTemplateName: null,
  };

  await setDoc(doc(db, USERS_COL, newUser.id), newUser);

  const { password, ...userWithoutPassword } = newUser;
  return {
    token: `mock_token_${newUser.id}`,
    user: userWithoutPassword,
  };
};

// ─────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────
export const loginApi = async (payload: LoginPayload): Promise<AuthResponse> => {
  await new Promise((r) => setTimeout(r, 400));

  const q = query(collection(db, USERS_COL), where("email", "==", payload.email));
  const snap = await getDocs(q);

  if (snap.empty) {
    throw { response: { data: { message: "No account found with this email" } } };
  }

  const userDoc = snap.docs[0].data();
  if (userDoc.password !== payload.password) {
    throw { response: { data: { message: "Incorrect password" } } };
  }

  const { password, ...userWithoutPassword } = userDoc;
  return {
    token: `mock_token_${userDoc.id}`,
    user: userWithoutPassword as AuthResponse["user"],
  };
};

// ─────────────────────────────────────────────────────────
// GET ME — restore session
// ─────────────────────────────────────────────────────────
export const getMeApi = async (): Promise<AuthResponse["user"]> => {
  const userStr = localStorage.getItem("user");
  if (userStr) return JSON.parse(userStr);
  throw new Error("Not authenticated");
};

export default { loginApi, signupApi, getMeApi };

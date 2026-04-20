import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEditorStore } from "../store/editorStore";
import { useAuthStore } from "../store/authStore";
import EditorLayout from "../components/editor/EditorLayout";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import type { Template } from "../types";

// ✅ Fetch template from Firestore by ID
async function fetchTemplateFromFirestore(templateId: string): Promise<Template | null> {
  try {
    const snap = await getDoc(doc(db, "templates", templateId));
    if (!snap.exists()) return null;
    return snap.data() as Template;
  } catch (err) {
    console.error("[EditorPage] Firestore fetch error:", err);
    return null;
  }
}

export default function EditorPage() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, loadFromStorage: refreshAuthUser } = useAuthStore();
  const { loadTemplate, loadFromStorage }          = useEditorStore();

  const [status, setStatus] = useState<"loading" | "ready" | "no-template" | "not-assigned">("loading");

  // ── Refresh auth user from localStorage on mount ──
  useEffect(() => {
    refreshAuthUser();
  }, [refreshAuthUser]);

  useEffect(() => {
    const routeTemplateId: string | null = (location.state as any)?.templateId ?? null;
    const templateId: string | null      = routeTemplateId ?? user?.assignedTemplateId ?? null;

    console.log("=== [EDITOR PAGE MOUNT] ===");
    console.log("[EditorPage] resolved templateId:", templateId);
    console.log("[EditorPage] user.id:", user?.id);

    if (!templateId) {
      setStatus("not-assigned");
      return;
    }

    // ── STEP 1: Check localStorage editor save first ──────────────────────
    if (user?.id) {
      try {
        const raw  = localStorage.getItem(`editor_save_${user.id}`);
        if (raw) {
          const data  = JSON.parse(raw);
          const saved = data.currentTemplate ?? null;
          console.log("[EditorPage] saved.id:", saved?.id, "| needed:", templateId);

          if (saved?.id === templateId) {
            loadFromStorage(user.id);
            setStatus("ready");
            console.log("[EditorPage] ✅ Loaded from localStorage editor save");
            return;
          }
        }
      } catch (e) {
        console.error("[EditorPage] localStorage error:", e);
      }
    }

    // ── STEP 2: Check in-memory store ─────────────────────────────────────
    const storeState = useEditorStore.getState();
    if (storeState.currentTemplate?.id === templateId) {
      setStatus("ready");
      console.log("[EditorPage] ✅ Using in-memory store");
      return;
    }

    // ── STEP 3: Fresh load from Firestore ─────────────────────────────────
    console.log("[EditorPage] Fetching template from Firestore:", templateId);
    setStatus("loading");

    fetchTemplateFromFirestore(templateId).then((found) => {
      if (!found) {
        console.warn("[EditorPage] ❌ Template not found in Firestore");
        setStatus("no-template");
        return;
      }
      loadTemplate(found);
      setStatus("ready");
      console.log("[EditorPage] ✅ Fresh load from Firestore");
    });

  }, [location.state, user?.assignedTemplateId, user?.id]);

  // ── Loading screen ────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-gray-600">Loading editor...</p>
          <p className="text-xs text-gray-400 mt-1">Reading your template</p>
        </div>
      </div>
    );
  }

  // ── Not assigned screen ───────────────────────────────────────────────────
  if (status === "not-assigned") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">No Template Assigned</h2>
          <p className="text-sm text-gray-500 mb-6">You don't have a template assigned yet.</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Template not found screen ─────────────────────────────────────────────
  if (status === "no-template") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">Template Not Found</h2>
          <p className="text-sm text-gray-500 mb-2">The assigned template could not be loaded.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate("/dashboard")}
              className="px-5 py-2 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition text-sm"
            >
              ← Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition text-sm"
            >
              🔄 Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <EditorLayout />;
}
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEditorStore } from "../store/editorStore";
import { useAuthStore } from "../store/authStore";
import EditorLayout from "../components/editor/EditorLayout";
import type { Template } from "../types";

export default function EditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loadFromStorage: refreshAuthUser } = useAuthStore();
  const { loadTemplate, loadFromStorage } = useEditorStore();

  const [status, setStatus] = useState<"loading" | "ready" | "no-template" | "not-assigned">("loading");

  useEffect(() => {
    refreshAuthUser();
  }, [refreshAuthUser]);

  useEffect(() => {
    const routeTemplateId: string | null = (location.state as any)?.templateId ?? null;
    const templateId: string | null = user?.assignedTemplateId ?? routeTemplateId;

    console.log("=== [EDITOR PAGE MOUNT] ===");
    console.log("[EditorPage] location.state:", JSON.stringify(location.state));
    console.log("[EditorPage] user.assignedTemplateId:", user?.assignedTemplateId);
    console.log("[EditorPage] resolved templateId:", templateId);
    console.log("[EditorPage] user.id:", user?.id);

    if (!templateId) {
      setStatus("not-assigned");
      return;
    }

    if (user?.id) {
      try {
        const raw = localStorage.getItem(`editor_save_${user.id}`);
        console.log("[EditorPage] localStorage key: editor_save_" + user.id);
        console.log("[EditorPage] localStorage raw exists:", !!raw);

        if (raw) {
          const data = JSON.parse(raw);
          const saved = data.currentTemplate ?? null;
          console.log("[EditorPage] saved.id:", saved?.id);
          console.log("[EditorPage] templateId:", templateId);
          console.log("[EditorPage] IDs MATCH?", saved?.id === templateId);
          console.log("[EditorPage] saved cssVars:", JSON.stringify(saved?.cssVariables));
          console.log("[EditorPage] saved blocks:", saved?.blocks?.length);

          if (saved?.id === templateId) {
            loadFromStorage(user.id);
            setStatus("ready");
            console.log("[EditorPage] ✅ loadFromStorage called");

            // Verify store after load
            setTimeout(() => {
              const s = useEditorStore.getState();
              console.log("[EditorPage] POST-LOAD store cssVars:", JSON.stringify(s.currentTemplate?.cssVariables));
              console.log("[EditorPage] POST-LOAD store blocks:", s.currentTemplate?.blocks?.length);
            }, 100);
            return;
          } else {
            console.warn("[EditorPage] ⚠️ ID MISMATCH — saved:", saved?.id, "| needed:", templateId);
          }
        } else {
          console.warn("[EditorPage] ⚠️ No localStorage save found for user:", user.id);
        }
      } catch (e) {
        console.error("[EditorPage] ❌ localStorage error:", e);
      }
    } else {
      console.warn("[EditorPage] ⚠️ No user.id — cannot check localStorage");
    }

    const storeState = useEditorStore.getState();
    console.log("[EditorPage] store.currentTemplate.id:", storeState.currentTemplate?.id);
    console.log("[EditorPage] store IDs MATCH?", storeState.currentTemplate?.id === templateId);

    if (storeState.currentTemplate?.id === templateId) {
      setStatus("ready");
      console.log("[EditorPage] ✅ Using in-memory store");
      return;
    }

    console.log("[EditorPage] ⚠️ Falling through to FRESH LOAD — all edits will be lost!");
    try {
      const raw = localStorage.getItem("lp_templates");
      if (!raw) {
        setStatus("no-template");
        return;
      }
      const templates: Template[] = JSON.parse(raw);
      const found = templates.find((t) => t.id === templateId);
      if (!found) {
        setStatus("no-template");
        return;
      }
      loadTemplate(found);
      setStatus("ready");
      console.log("[EditorPage] ✅ Fresh load from lp_templates");
    } catch (err) {
      console.error("[EditorPage] Fresh load failed:", err);
      setStatus("no-template");
    }
  }, [location.state, user?.assignedTemplateId, user?.id, refreshAuthUser]);

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

  if (status === "not-assigned") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">No Template Assigned</h2>
          <p className="text-sm text-gray-500 mb-6">You don't have a template assigned yet.</p>
          <button onClick={() => navigate("/dashboard")} className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (status === "no-template") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">Template Not Found</h2>
          <p className="text-sm text-gray-500 mb-2">The assigned template could not be loaded.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate("/dashboard")} className="px-5 py-2 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition text-sm">
              ← Dashboard
            </button>
            <button onClick={() => window.location.reload()} className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition text-sm">
              🔄 Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <EditorLayout />;
}

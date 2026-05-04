import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEditorStore } from "../store/editorStore";
import { useAuthStore } from "../store/authStore";
import EditorLayout from "../components/editor/EditorLayout";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import type { Template } from "../types";

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
  const location = useLocation();
  const navigate = useNavigate();

  const { user, loadFromStorage: refreshAuthUser } = useAuthStore();
  const { loadTemplate, loadFromStorage, resetEditor } = useEditorStore();

  const [status, setStatus] = useState<"loading" | "ready" | "no-template" | "not-assigned">("loading");

  const routeTemplateId = useMemo(() => {
    return ((location.state as any)?.templateId as string | undefined) || null;
  }, [location.state]);

  const fallbackTemplateId = useMemo(() => {
    const ids = Array.isArray((user as any)?.assignedTemplateIds)
      ? ((user as any).assignedTemplateIds as string[])
      : [];

    return routeTemplateId || ids[0] || user?.assignedTemplateId || null;
  }, [routeTemplateId, user]);

  useEffect(() => {
    refreshAuthUser();
  }, [refreshAuthUser]);

  useEffect(() => {
    const templateId = fallbackTemplateId;

    if (!templateId) {
      resetEditor();
      setStatus("not-assigned");
      return;
    }

    let cancelled = false;

    const init = async () => {
      setStatus("loading");

      // Important: clear previous template first
      // This stops template 1 from staying visible when opening template 2.
      resetEditor();

      if (user?.id) {
        try {
          await loadFromStorage(user.id, templateId);

          const loadedTemplate = useEditorStore.getState().currentTemplate;

          if (!cancelled && loadedTemplate?.id === templateId) {
            setStatus("ready");
           
            return;
          }
        } catch (e) {
          console.error("[EditorPage] loadFromStorage error:", e);
        }
      }

      const found = await fetchTemplateFromFirestore(templateId);

      if (cancelled) return;

      if (!found) {
        setStatus("no-template");
        return;
      }

      loadTemplate(found);
      setStatus("ready");
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [
    fallbackTemplateId,
    routeTemplateId,
    user?.id,
    loadTemplate,
    loadFromStorage,
    resetEditor,
  ]);

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

  if (status === "no-template") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">Template Not Found</h2>
          <p className="text-sm text-gray-500 mb-2">This template could not be loaded.</p>

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

  return <EditorLayout key={fallbackTemplateId || "editor"} />;
}
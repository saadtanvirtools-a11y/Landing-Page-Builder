import { useState, useEffect } from "react";
import { LayoutTemplate, CheckCircle, Clock, Trash2, Eye, MoreVertical } from "lucide-react";
import type { Template } from "../../types";

interface Props {
  refresh: number;
  onSelect: (t: Template) => void;
  selectedId: string | null;
}

// ✅ Read from localStorage (same place TemplateUpload saves)
function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem("lp_templates");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function TemplateList({ refresh, onSelect, selectedId }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // ✅ Re-read localStorage every time refresh changes
  useEffect(() => {
    setLoading(true);

    // ── REAL API CALL (uncomment when backend ready) ──
    // const res = await axios.get("/api/admin/templates");
    // setTemplates(res.data);
    // ─────────────────────────────────────────────────

    setTimeout(() => {
      const data = loadTemplates(); // ✅ reads fresh from localStorage
      setTemplates(data);
      setLoading(false);
    }, 400);
  }, [refresh]); // ✅ runs every time AdminPage calls onUploaded()

  function handleDelete(id: string) {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    // ✅ Also remove from localStorage
    localStorage.setItem("lp_templates", JSON.stringify(updated));
    setOpenMenu(null);

    // ── REAL API CALL ─────────────────────────────────
    // await axios.delete(`/api/admin/templates/${id}`);
    // ─────────────────────────────────────────────────
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Templates</h3>
          <p className="text-xs text-gray-400 mt-0.5">{templates.length} uploaded</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <LayoutTemplate size={14} />
          <span>Click to select</span>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
          <LayoutTemplate size={48} className="mb-3 opacity-40" />
          <p className="text-sm">No templates yet</p>
          <p className="text-xs mt-1">Upload one using the form</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => {
            const isSelected = selectedId === template.id;
            return (
              <div
                key={template.id}
                onClick={() => onSelect(template)}
                className="rounded-xl border p-4 cursor-pointer transition-all"
                style={{
                  borderColor: isSelected ? "#6366f1" : "#f3f4f6",
                  backgroundColor: isSelected ? "#eef2ff" : "#fafafa",
                  boxShadow: isSelected ? "0 0 0 2px #c7d2fe" : "none",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: isSelected ? "#c7d2fe" : "#e5e7eb" }}>
                      <LayoutTemplate size={18} style={{ color: isSelected ? "#4f46e5" : "#9ca3af" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{template.templateName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">ID: {template.id}</p>
                    </div>
                  </div>

                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenu(openMenu === template.id ? null : template.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-gray-200 transition"
                    >
                      <MoreVertical size={14} className="text-gray-400" />
                    </button>

                    {openMenu === template.id && (
                      <div className="absolute right-0 top-8 rounded-xl border border-gray-100 shadow-xl z-10 overflow-hidden min-w-36 bg-white">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenu(null);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          <Eye size={13} /> Preview
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(template.id);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <CheckCircle size={11} className="text-indigo-400" />
                    {template.blocks.length} blocks
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={11} />
                    {template.createdAt}
                  </span>
                  {isSelected && (
                    <span className="ml-auto text-xs font-semibold text-indigo-500 flex items-center gap-1">
                      <CheckCircle size={11} /> Selected
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

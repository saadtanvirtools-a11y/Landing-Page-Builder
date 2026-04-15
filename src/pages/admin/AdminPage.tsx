import { useState } from "react";
import { LayoutTemplate, Blocks, Users, Upload, List, UserCheck } from "lucide-react";
import TemplateUpload from "../../components/admin/TemplateUpload";
import TemplateList from "../../components/admin/TemplateList";
import AssignTemplate from "../../components/admin/AssignTemplate";
import BlockUpload from "../../components/admin/BlockUpload";
import BlockList from "../../components/admin/BlockList";
import type { Template } from "../../types";

// ── Tab definitions ───────────────────────────────────
type MainTab = "templates" | "blocks" | "users";
type TemplateSubTab = "upload" | "list";
type BlockSubTab = "upload" | "list";

export default function AdminPage() {
  const [mainTab, setMainTab] = useState<MainTab>("templates");
  const [templateSubTab, setTemplateSubTab] = useState<TemplateSubTab>("list");
  const [blockSubTab, setBlockSubTab] = useState<BlockSubTab>("list");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateRefresh, setTemplateRefresh] = useState(0);
  const [blockRefresh, setBlockRefresh] = useState(0);

  function handleTemplateUploaded() {
    setTemplateRefresh((n) => n + 1);
    setTemplateSubTab("list");
  }

  function handleBlockUploaded() {
    setBlockRefresh((n) => n + 1);
    setBlockSubTab("list");
  }

  // ── Main tab config ───────────────────────────────
  const mainTabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [
    { id: "templates", label: "Templates", icon: <LayoutTemplate size={16} /> },
    { id: "blocks", label: "Blocks", icon: <Blocks size={16} /> },
    { id: "users", label: "Users", icon: <Users size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── TOP HEADER ─────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Admin Panel</h1>
            <p className="text-xs text-gray-400 mt-0.5">Manage templates, blocks and users</p>
          </div>
          {/* Quick action button */}
          {mainTab === "templates" && (
            <button
              onClick={() => setTemplateSubTab(templateSubTab === "upload" ? "list" : "upload")}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600
                         hover:bg-indigo-700 text-white text-sm font-semibold
                         rounded-xl transition shadow-sm"
            >
              {templateSubTab === "upload" ? (
                <>
                  <List size={14} /> View Templates
                </>
              ) : (
                <>
                  <Upload size={14} /> Upload Template
                </>
              )}
            </button>
          )}
          {mainTab === "blocks" && (
            <button
              onClick={() => setBlockSubTab(blockSubTab === "upload" ? "list" : "upload")}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600
                         hover:bg-indigo-700 text-white text-sm font-semibold
                         rounded-xl transition shadow-sm"
            >
              {blockSubTab === "upload" ? (
                <>
                  <List size={14} /> View Blocks
                </>
              ) : (
                <>
                  <Upload size={14} /> Upload Block
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN TABS ──────────────────────────────── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-0">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMainTab(tab.id)}
                className={`
                  flex items-center gap-2 px-5 py-3.5 text-sm font-semibold
                  border-b-2 transition-all
                  ${mainTab === tab.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600"}
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* ════ TEMPLATES TAB ════ */}
        {mainTab === "templates" && (
          <div>
            {/* Sub-tabs */}
            <div className="flex gap-2 mb-5">
              {(["list", "upload"] as TemplateSubTab[]).map((sub) => (
                <button
                  key={sub}
                  onClick={() => setTemplateSubTab(sub)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                    transition-all
                    ${templateSubTab === sub ? "bg-indigo-100 text-indigo-700" : "bg-white text-gray-400 hover:bg-gray-100 border border-gray-200"}
                  `}
                >
                  {sub === "list" ? (
                    <>
                      <List size={12} /> All Templates
                    </>
                  ) : (
                    <>
                      <Upload size={12} /> Upload New
                    </>
                  )}
                </button>
              ))}
            </div>

            {templateSubTab === "upload" ? (
              /* Upload form */
              <div className="max-w-2xl">
                <TemplateUpload onUploaded={handleTemplateUploaded} />
              </div>
            ) : (
              /* List + Assign side by side */
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <TemplateList refresh={templateRefresh} onSelect={setSelectedTemplate} selectedId={selectedTemplate?.id ?? null} />
                <AssignTemplate selectedTemplate={selectedTemplate} />
              </div>
            )}
          </div>
        )}

        {/* ════ BLOCKS TAB ════ */}
        {mainTab === "blocks" && (
          <div>
            {/* Sub-tabs */}
            <div className="flex gap-2 mb-5">
              {(["list", "upload"] as BlockSubTab[]).map((sub) => (
                <button
                  key={sub}
                  onClick={() => setBlockSubTab(sub)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                    transition-all
                    ${blockSubTab === sub ? "bg-indigo-100 text-indigo-700" : "bg-white text-gray-400 hover:bg-gray-100 border border-gray-200"}
                  `}
                >
                  {sub === "list" ? (
                    <>
                      <List size={12} /> All Blocks
                    </>
                  ) : (
                    <>
                      <Upload size={12} /> Upload New
                    </>
                  )}
                </button>
              ))}
            </div>

            {/* Tier legend */}
            <div
              className="flex items-center gap-4 mb-5 px-4 py-2.5 bg-white
                            rounded-xl border border-gray-100 w-fit"
            >
              <span className="text-xs text-gray-400 font-semibold">Tier legend:</span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                Free — all users can use
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-600">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                Premium — shown locked 🔒
              </span>
            </div>

            {blockSubTab === "upload" ? (
              /* Block upload form */
              <div className="max-w-2xl">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-linear-to-r from-indigo-600 to-violet-600">
                    <h3 className="text-base font-bold text-white">Upload Block</h3>
                    <p className="text-xs text-indigo-200 mt-0.5">
                      ZIP must contain an <code className="bg-white/20 px-1 rounded">index.html</code> with <code className="bg-white/20 px-1 rounded">data-block</code> attribute
                    </p>
                  </div>
                  <div className="p-6">
                    <BlockUpload onUploaded={handleBlockUploaded} />
                  </div>
                </div>
              </div>
            ) : (
              /* Block list */
              <BlockList refresh={blockRefresh} />
            )}
          </div>
        )}

        {/* ════ USERS TAB ════ */}
        {mainTab === "users" && (
          <div>
            <div className="flex gap-2 mb-5">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                              text-xs font-semibold bg-indigo-100 text-indigo-700"
              >
                <UserCheck size={12} /> User Management
              </div>
            </div>
            {/* Assign template with full template selection */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <TemplateList refresh={templateRefresh} onSelect={setSelectedTemplate} selectedId={selectedTemplate?.id ?? null} />
              <AssignTemplate selectedTemplate={selectedTemplate} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

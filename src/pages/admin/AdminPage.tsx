import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutTemplate, Blocks, Users, Upload, List, UserCheck, LogOut } from "lucide-react";
import TemplateUpload from "../../components/admin/TemplateUpload";
import TemplateList from "../../components/admin/TemplateList";
import AssignTemplate from "../../components/admin/AssignTemplate";
import BlockUpload from "../../components/admin/BlockUpload";
import BlockList from "../../components/admin/BlockList";
import { getAllUsers } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import type { Template } from "../../types";

type MainTab       = "templates" | "blocks" | "users";
type TemplateSubTab = "upload" | "list";
type BlockSubTab    = "upload" | "list";

export default function AdminPage() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const [mainTab,         setMainTab]         = useState<MainTab>("templates");
  const [templateSubTab,  setTemplateSubTab]  = useState<TemplateSubTab>("list");
  const [blockSubTab,     setBlockSubTab]      = useState<BlockSubTab>("list");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateRefresh,  setTemplateRefresh]  = useState(0);
  const [blockRefresh,     setBlockRefresh]      = useState(0);

  // ── Users list state ──────────────────────────────────
  const [allUsers,      setAllUsers]      = useState<any[]>([]);
  const [usersLoading,  setUsersLoading]  = useState(false);

  // Load users when Users tab is opened
  useEffect(() => {
    if (mainTab !== "users") return;
    setUsersLoading(true);
    getAllUsers()
      .then((users) => setAllUsers(users.filter((u) => u.role !== "admin")))
      .catch(console.error)
      .finally(() => setUsersLoading(false));
  }, [mainTab, templateRefresh]);

  function handleTemplateUploaded() {
    setTemplateRefresh((n) => n + 1);
    setTemplateSubTab("list");
  }
  function handleBlockUploaded() {
    setBlockRefresh((n) => n + 1);
    setBlockSubTab("list");
  }
  function handleLogout() {
    logout();
    navigate("/login");
  }

  const mainTabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [
    { id: "templates", label: "Templates", icon: <LayoutTemplate size={16} /> },
    { id: "blocks",    label: "Blocks",    icon: <Blocks size={16} />         },
    { id: "users",     label: "Users",     icon: <Users size={16} />          },
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

          <div className="flex items-center gap-3">
            {/* Quick action */}
            {mainTab === "templates" && (
              <button
                onClick={() => setTemplateSubTab(templateSubTab === "upload" ? "list" : "upload")}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600
                           hover:bg-indigo-700 text-white text-sm font-semibold
                           rounded-xl transition shadow-sm"
              >
                {templateSubTab === "upload" ? <><List size={14} /> View Templates</> : <><Upload size={14} /> Upload Template</>}
              </button>
            )}
            {mainTab === "blocks" && (
              <button
                onClick={() => setBlockSubTab(blockSubTab === "upload" ? "list" : "upload")}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600
                           hover:bg-indigo-700 text-white text-sm font-semibold
                           rounded-xl transition shadow-sm"
              >
                {blockSubTab === "upload" ? <><List size={14} /> View Blocks</> : <><Upload size={14} /> Upload Block</>}
              </button>
            )}

            {/* ✅ LOGOUT BUTTON */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-50
                         hover:bg-red-100 text-red-600 text-sm font-semibold
                         rounded-xl transition border border-red-200"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
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
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold
                  border-b-2 transition-all
                  ${mainTab === tab.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-400 hover:text-gray-600"}`}
              >
                {tab.icon}{tab.label}
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
            <div className="flex gap-2 mb-5">
              {(["list", "upload"] as TemplateSubTab[]).map((sub) => (
                <button key={sub} onClick={() => setTemplateSubTab(sub)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${templateSubTab === sub ? "bg-indigo-100 text-indigo-700" : "bg-white text-gray-400 hover:bg-gray-100 border border-gray-200"}`}>
                  {sub === "list" ? <><List size={12} /> All Templates</> : <><Upload size={12} /> Upload New</>}
                </button>
              ))}
            </div>
            {templateSubTab === "upload" ? (
              <div className="max-w-2xl"><TemplateUpload onUploaded={handleTemplateUploaded} /></div>
            ) : (
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
            <div className="flex gap-2 mb-5">
              {(["list", "upload"] as BlockSubTab[]).map((sub) => (
                <button key={sub} onClick={() => setBlockSubTab(sub)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${blockSubTab === sub ? "bg-indigo-100 text-indigo-700" : "bg-white text-gray-400 hover:bg-gray-100 border border-gray-200"}`}>
                  {sub === "list" ? <><List size={12} /> All Blocks</> : <><Upload size={12} /> Upload New</>}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 mb-5 px-4 py-2.5 bg-white rounded-xl border border-gray-100 w-fit">
              <span className="text-xs text-gray-400 font-semibold">Tier legend:</span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-600"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Free</span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-600"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />Premium 🔒</span>
            </div>
            {blockSubTab === "upload" ? (
              <div className="max-w-2xl">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600">
                    <h3 className="text-base font-bold text-white">Upload Block</h3>
                  </div>
                  <div className="p-6"><BlockUpload onUploaded={handleBlockUploaded} /></div>
                </div>
              </div>
            ) : (
              <BlockList refresh={blockRefresh} />
            )}
          </div>
        )}

        {/* ════ USERS TAB ════ */}
        {mainTab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-100 text-indigo-700">
                <UserCheck size={12} /> All Registered Users
              </div>
              <button onClick={() => { setUsersLoading(true); getAllUsers().then((u) => setAllUsers(u.filter((x) => x.role !== "admin"))).finally(() => setUsersLoading(false)); }}
                className="text-xs text-indigo-600 hover:underline">🔄 Refresh</button>
            </div>

            {/* ── Users Table ── */}
            {usersLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : allUsers.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">👥</div>
                <p className="font-semibold">No users registered yet</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Name</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Email</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Joined</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Assigned Template</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {allUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                              {u.name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-gray-700">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{u.email}</td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          {u.assignedTemplateName ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-lg border border-green-100">
                              ✅ {u.assignedTemplateName}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">Not assigned</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => { setSelectedTemplate(null); setMainTab("templates"); setTemplateSubTab("list"); }}
                            className="text-xs text-indigo-600 hover:underline font-medium"
                          >
                            Assign Template →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                  {allUsers.length} user{allUsers.length !== 1 ? "s" : ""} registered
                </div>
              </div>
            )}

            {/* Assign template section below table */}
            <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
              <TemplateList refresh={templateRefresh} onSelect={setSelectedTemplate} selectedId={selectedTemplate?.id ?? null} />
              <AssignTemplate selectedTemplate={selectedTemplate} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
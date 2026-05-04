import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutTemplate,
  Blocks,
  Users,
  Upload,
  List,
  UserCheck,
  LogOut,
  Trash2,
} from "lucide-react";
import TemplateUpload from "../../components/admin/TemplateUpload";
import TemplateList from "../../components/admin/TemplateList";
import AssignTemplate from "../../components/admin/AssignTemplate";
import BlockUpload from "../../components/admin/BlockUpload";
import BlockList from "../../components/admin/BlockList";
import { getAllUsers, createUserByAdmin, deleteUserByAdmin } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import type { Template } from "../../types";

type MainTab = "templates" | "blocks" | "users";
type TemplateSubTab = "upload" | "list";
type BlockSubTab = "upload" | "list";
type UserSubTab = "list" | "add";

function AddUserForm({ onUserAdded }: { onUserAdded: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let result = "";
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createUserByAdmin(email, name, password);
      setName("");
      setEmail("");
      setPassword("");
      onUserAdded();
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600">
          <h3 className="text-base font-bold text-white">Add New User</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter user name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter email address"
              required
            />
          </div>

       <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Password
  </label>

  <div className="flex gap-2">
    <div className="relative flex-1">
      <input
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        placeholder="Enter or generate password"
        required
      />

      {/* 👁️ Eye Icon */}
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {showPassword ? (
          // Eye OFF
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19C7 19 2.73 15.11 1 12c.73-1.31 1.73-2.61 2.94-3.78M9.9 4.24A10.94 10.94 0 0 1 12 5c5 0 9.27 3.89 11 7-.73 1.31-1.73 2.61-2.94 3.78M1 1l22 22" />
          </svg>
        ) : (
          // Eye ON
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>

    {/* Generate Button */}
    <button
      type="button"
      onClick={generatePassword}
      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition"
    >
      Generate
    </button>
  </div>
</div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg transition"
          >
            {loading ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const [mainTab, setMainTab] = useState<MainTab>("templates");
  const [templateSubTab, setTemplateSubTab] = useState<TemplateSubTab>("list");
  const [blockSubTab, setBlockSubTab] = useState<BlockSubTab>("list");
  const [userSubTab, setUserSubTab] = useState<UserSubTab>("list");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateRefresh, setTemplateRefresh] = useState(0);
  const [blockRefresh, setBlockRefresh] = useState(0);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const users = await getAllUsers();
      setAllUsers(users.filter((u) => u.role !== "admin"));
    } catch (err) {
      console.error("[AdminPage] Failed to load users:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (mainTab !== "users") return;
    loadUsers();
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

  async function handleDeleteUser(userToDelete: any) {
    const confirmed = window.confirm(
      `Are you sure you want to remove "${userToDelete.name}"?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingUserId(userToDelete.id);

    try {
      await deleteUserByAdmin(userToDelete.id);
      setAllUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
    } catch (err: any) {
      alert(err?.message || "Failed to remove user");
    } finally {
      setDeletingUserId(null);
    }
  }

  const mainTabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [
    { id: "templates", label: "Templates", icon: <LayoutTemplate size={16} /> },
    { id: "blocks", label: "Blocks", icon: <Blocks size={16} /> },
    { id: "users", label: "Users", icon: <Users size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* TOP HEADER */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Admin Panel</h1>
            <p className="text-xs text-gray-400 mt-0.5">Manage templates, blocks and users</p>
          </div>

          <div className="flex items-center gap-3">
            {mainTab === "templates" && (
              <button
                onClick={() => setTemplateSubTab(templateSubTab === "upload" ? "list" : "upload")}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
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
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
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

            {mainTab === "users" && (
              <button
                onClick={() => setUserSubTab(userSubTab === "add" ? "list" : "add")}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
              >
                {userSubTab === "add" ? (
                  <>
                    <List size={14} /> View Users
                  </>
                ) : (
                  <>
                    <UserCheck size={14} /> Add User
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl transition border border-red-200"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* MAIN TABS */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-0">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMainTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-all ${
                  mainTab === tab.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* TEMPLATES TAB */}
        {mainTab === "templates" && (
          <div>
            <div className="flex gap-2 mb-5">
              {(["list", "upload"] as TemplateSubTab[]).map((sub) => (
                <button
                  key={sub}
                  onClick={() => setTemplateSubTab(sub)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    templateSubTab === sub
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-white text-gray-400 hover:bg-gray-100 border border-gray-200"
                  }`}
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
              <div className="max-w-2xl">
                <TemplateUpload onUploaded={handleTemplateUploaded} />
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <TemplateList
                  refresh={templateRefresh}
                  onSelect={setSelectedTemplate}
                  selectedId={selectedTemplate?.id ?? null}
                />
                <AssignTemplate selectedTemplate={selectedTemplate} />
              </div>
            )}
          </div>
        )}

        {/* BLOCKS TAB */}
        {mainTab === "blocks" && (
          <div>
            <div className="flex gap-2 mb-5">
              {(["list", "upload"] as BlockSubTab[]).map((sub) => (
                <button
                  key={sub}
                  onClick={() => setBlockSubTab(sub)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    blockSubTab === sub
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-white text-gray-400 hover:bg-gray-100 border border-gray-200"
                  }`}
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

            <div className="flex items-center gap-4 mb-5 px-4 py-2.5 bg-white rounded-xl border border-gray-100 w-fit">
              <span className="text-xs text-gray-400 font-semibold">Tier legend:</span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                Free
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-600">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                Premium 🔒
              </span>
            </div>

            {blockSubTab === "upload" ? (
              <div className="max-w-2xl">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600">
                    <h3 className="text-base font-bold text-white">Upload Block</h3>
                  </div>
                  <div className="p-6">
                    <BlockUpload onUploaded={handleBlockUploaded} />
                  </div>
                </div>
              </div>
            ) : (
              <BlockList refresh={blockRefresh} />
            )}
          </div>
        )}

        {/* USERS TAB */}
        {mainTab === "users" && (
          <div>
            <div className="flex gap-2 mb-5">
              {(["list", "add"] as UserSubTab[]).map((sub) => (
                <button
                  key={sub}
                  onClick={() => setUserSubTab(sub)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    userSubTab === sub
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-white text-gray-400 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {sub === "list" ? (
                    <>
                      <List size={12} /> All Users
                    </>
                  ) : (
                    <>
                      <UserCheck size={12} /> Add User
                    </>
                  )}
                </button>
              ))}
            </div>

            {userSubTab === "add" ? (
              <AddUserForm
                onUserAdded={() => {
                  setUserSubTab("list");
                  loadUsers();
                }}
              />
            ) : (
              <>
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
                          <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Name
                          </th>
                          <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Email
                          </th>
                          <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Joined
                          </th>
                          <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Assigned Template
                          </th>
                          <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Actions
                          </th>
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
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => {
                                    setSelectedTemplate(null);
                                    setMainTab("templates");
                                    setTemplateSubTab("list");
                                  }}
                                  className="text-xs text-indigo-600 hover:underline font-medium"
                                >
                                  Assign Template →
                                </button>

                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  disabled={deletingUserId === u.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Trash2 size={12} />
                                  {deletingUserId === u.id ? "Removing..." : "Remove"}
                                </button>
                              </div>
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

                <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <TemplateList
                    refresh={templateRefresh}
                    onSelect={setSelectedTemplate}
                    selectedId={selectedTemplate?.id ?? null}
                  />
                  <AssignTemplate selectedTemplate={selectedTemplate} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
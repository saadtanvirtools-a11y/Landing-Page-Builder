import { useState, useEffect } from "react";
import { UserCheck, CheckCircle, XCircle, Users, Loader2, AlertTriangle, Search, LayoutTemplate } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import type { User, Template } from "../../types";

/* ─── Props ─────────────────────────────────────────────── */
interface Props {
  selectedTemplate: Template | null;
}

/* ─── Helpers — read/write mock_users localStorage ─────── */
function getStoredUsers(): User[] {
  try {
    const raw = localStorage.getItem("mock_users");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredUsers(users: User[]) {
  localStorage.setItem("mock_users", JSON.stringify(users));
}

/* ─── Component ─────────────────────────────────────────── */
export default function AssignTemplate({ selectedTemplate }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [flashMsg, setFlashMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  /* ── Load users from localStorage (exclude admin) ── */
  useEffect(() => {
    const all = getStoredUsers();
    // Only show non-admin users
    setUsers(all.filter((u) => u.role === "user"));
  }, [selectedTemplate?.id]);

  /* ── Auto-clear flash message ── */
  useEffect(() => {
    if (!flashMsg) return;
    const t = setTimeout(() => setFlashMsg(null), 2500);
    return () => clearTimeout(t);
  }, [flashMsg]);

  /* ── Filtered list ── */
  const filteredUsers = users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  /* ── Assign template to user ── */
  async function handleAssign(userId: string) {
    if (!selectedTemplate) return;
    setAssigningId(userId);

    try {
      // ── REAL API CALL (uncomment when backend ready) ──
      // await api.post("/admin/assign", {
      //   userId,
      //   templateId: selectedTemplate.id,
      // });
      // ─────────────────────────────────────────────────

      await new Promise((r) => setTimeout(r, 800)); // mock delay

      // Update localStorage mock_users
      const allUsers = getStoredUsers();
      const updated = allUsers.map((u) =>
        u.id === userId
          ? {
              ...u,
              assignedTemplateId: selectedTemplate.id,
              assignedTemplateName: selectedTemplate.templateName,
            }
          : u,
      );
      saveStoredUsers(updated);

      // Also update currently logged-in user if it's them
      const currentUser = localStorage.getItem("user");
      if (currentUser) {
        const parsed = JSON.parse(currentUser) as User;
        if (parsed.id === userId) {
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...parsed,
              assignedTemplateId: selectedTemplate.id,
              assignedTemplateName: selectedTemplate.templateName,
            }),
          );
          useAuthStore.getState().loadFromStorage();
        }
      }

      // Refresh local state (only non-admin)
      setUsers(updated.filter((u) => u.role === "user"));
      setFlashMsg({ type: "success", text: `"${selectedTemplate.templateName}" assigned to ${updated.find((u) => u.id === userId)?.name}!` });
    } catch {
      setFlashMsg({ type: "error", text: "Assignment failed. Please try again." });
    } finally {
      setAssigningId(null);
    }
  }

  /* ── Remove assignment from user ── */
  async function handleRemove(userId: string) {
    setRemovingId(userId);

    try {
      // ── REAL API CALL (uncomment when backend ready) ──
      // await api.delete(`/admin/assign/${userId}`);
      // ─────────────────────────────────────────────────

      await new Promise((r) => setTimeout(r, 500)); // mock delay

      const allUsers = getStoredUsers();
      const updated = allUsers.map((u) => (u.id === userId ? { ...u, assignedTemplateId: null, assignedTemplateName: null } : u));
      saveStoredUsers(updated);

      // Also update currently logged-in user if it's them
      const currentUser = localStorage.getItem("user");
      if (currentUser) {
        const parsed = JSON.parse(currentUser) as User;
        if (parsed.id === userId) {
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...parsed,
              assignedTemplateId: null,
              assignedTemplateName: null,
            }),
          );
          useAuthStore.getState().loadFromStorage();
        }
      }

      setUsers(updated.filter((u) => u.role === "user"));
      setFlashMsg({ type: "success", text: "Template assignment removed." });
    } catch {
      setFlashMsg({ type: "error", text: "Failed to remove assignment." });
    } finally {
      setRemovingId(null);
    }
  }

  /* ── No template selected ── */
  if (!selectedTemplate) {
    return (
      <div
        className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm
                      flex flex-col items-center justify-center h-64 text-center"
      >
        <LayoutTemplate size={48} className="text-gray-200 mb-3" />
        <p className="text-sm font-semibold text-gray-400">No template selected</p>
        <p className="text-xs text-gray-300 mt-1">Select a template from the list to assign it to users</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-gray-800">Assign to Users</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          {users.length} registered user{users.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Selected Template Banner */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
        <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
          <LayoutTemplate size={16} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-indigo-700 truncate">{selectedTemplate.templateName}</p>
          <p className="text-xs text-indigo-400">
            {selectedTemplate.blocks.length} blocks · ID: {selectedTemplate.id}
          </p>
        </div>
        <CheckCircle size={16} className="text-indigo-500 shrink-0" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Total Users",
            value: users.length,
            color: "#6366f1",
          },
          {
            label: "Assigned",
            value: users.filter((u) => u.assignedTemplateId).length,
            color: "#22c55e",
          },
          {
            label: "Unassigned",
            value: users.filter((u) => !u.assignedTemplateId).length,
            color: "#f59e0b",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-100 p-3 text-center bg-gray-50">
            <p className="text-xl font-bold" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200
                     text-sm outline-none bg-gray-50 text-gray-700
                     focus:border-indigo-300"
        />
      </div>

      {/* Flash Message */}
      {flashMsg && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium border"
          style={{
            backgroundColor: flashMsg.type === "success" ? "#f0fdf4" : "#fef2f2",
            borderColor: flashMsg.type === "success" ? "#bbf7d0" : "#fecaca",
            color: flashMsg.type === "success" ? "#166534" : "#991b1b",
          }}
        >
          {flashMsg.type === "success" ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {flashMsg.text}
        </div>
      )}

      {/* Users List */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-300">
            <Users size={40} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">{users.length === 0 ? "No users have signed up yet" : "No users found"}</p>
            {users.length === 0 && <p className="text-xs mt-1 text-gray-300">Users will appear here after they sign up</p>}
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isAssignedThis = user.assignedTemplateId === selectedTemplate.id;
            const isAssignedOther = user.assignedTemplateId && user.assignedTemplateId !== selectedTemplate.id;
            const isAssigning = assigningId === user.id;
            const isRemoving = removingId === user.id;

            return (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 rounded-xl border transition-all"
                style={{
                  borderColor: isAssignedThis ? "#a5b4fc" : isAssignedOther ? "#e5e7eb" : "#f3f4f6",
                  backgroundColor: isAssignedThis ? "#eef2ff" : isAssignedOther ? "#fafafa" : "#fafafa",
                }}
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center
                                text-sm font-bold shrink-0 bg-indigo-100 text-indigo-600"
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  {/* Show which template is currently assigned */}
                  {user.assignedTemplateName && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: isAssignedThis ? "#6366f1" : "#9ca3af" }}>
                      {isAssignedThis ? "✓ This template" : `→ ${user.assignedTemplateName}`}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {isAssignedThis ? (
                    /* Already assigned this template — show Remove */
                    <button
                      onClick={() => handleRemove(user.id)}
                      disabled={isRemoving}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg
                                 text-xs font-medium bg-red-50 text-red-500
                                 hover:bg-red-100 disabled:opacity-50 transition"
                    >
                      {isRemoving ? (
                        <>
                          <Loader2 size={11} className="animate-spin" /> Removing...
                        </>
                      ) : (
                        <>
                          <XCircle size={11} /> Remove
                        </>
                      )}
                    </button>
                  ) : (
                    /* Not assigned this template — show Assign */
                    <button
                      onClick={() => handleAssign(user.id)}
                      disabled={isAssigning}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg
                                 text-xs font-medium bg-indigo-600 text-white
                                 hover:bg-indigo-700 disabled:opacity-50 transition"
                    >
                      {isAssigning ? (
                        <>
                          <Loader2 size={11} className="animate-spin" /> Assigning...
                        </>
                      ) : (
                        <>
                          <UserCheck size={11} /> {isAssignedOther ? "Reassign" : "Assign"}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { UserCheck, CheckCircle, XCircle, Users, Loader2, AlertTriangle, Search, LayoutTemplate } from "lucide-react";
import { db } from "../../firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { useAuthStore } from "../../store/authStore";
import type { User, Template } from "../../types";

interface Props {
  selectedTemplate: Template | null;
}

type UserWithMultiTemplates = User & {
  assignedTemplateIds?: string[];
  assignedTemplateNames?: string[];
};

// ✅ Load users from Firestore
async function getFirestoreUsers(): Promise<UserWithMultiTemplates[]> {
  const snap = await getDocs(collection(db, "users"));

  return snap.docs
    .map((d) => {
      const { password, ...u } = d.data() as any;

      const assignedTemplateIds = Array.isArray(u.assignedTemplateIds)
        ? u.assignedTemplateIds
        : u.assignedTemplateId
          ? [u.assignedTemplateId]
          : [];

      const assignedTemplateNames = Array.isArray(u.assignedTemplateNames)
        ? u.assignedTemplateNames
        : u.assignedTemplateName
          ? [u.assignedTemplateName]
          : [];

      return {
        ...u,
        assignedTemplateIds,
        assignedTemplateNames,
      } as UserWithMultiTemplates;
    })
    .filter((u) => u.role !== "admin");
}

export default function AssignTemplate({ selectedTemplate }: Props) {
  const [users, setUsers] = useState<UserWithMultiTemplates[]>([]);
  const [search, setSearch] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [flashMsg, setFlashMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getFirestoreUsers()
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedTemplate?.id]);

  useEffect(() => {
    if (!flashMsg) return;
    const t = setTimeout(() => setFlashMsg(null), 2500);
    return () => clearTimeout(t);
  }, [flashMsg]);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAssign(userId: string) {
    if (!selectedTemplate) return;

    setAssigningId(userId);

    try {
      const targetUser = users.find((u) => u.id === userId);
      if (!targetUser) throw new Error("User not found");

      const currentIds = Array.isArray(targetUser.assignedTemplateIds)
        ? targetUser.assignedTemplateIds
        : [];

      const currentNames = Array.isArray(targetUser.assignedTemplateNames)
        ? targetUser.assignedTemplateNames
        : [];

      const alreadyAssigned = currentIds.includes(selectedTemplate.id);

      if (alreadyAssigned) {
        setFlashMsg({
          type: "success",
          text: `"${selectedTemplate.templateName}" is already assigned to ${targetUser.name}.`,
        });
        setAssigningId(null);
        return;
      }

      const nextIds = [...currentIds, selectedTemplate.id];
      const nextNames = [...currentNames, selectedTemplate.templateName];

      await updateDoc(doc(db, "users", userId), {
        assignedTemplateIds: nextIds,
        assignedTemplateNames: nextNames,

        // keep old fields for compatibility with existing user/editor code
        assignedTemplateId: nextIds[0] ?? null,
        assignedTemplateName: nextNames[0] ?? null,
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                assignedTemplateIds: nextIds,
                assignedTemplateNames: nextNames,
                assignedTemplateId: nextIds[0] ?? null,
                assignedTemplateName: nextNames[0] ?? null,
              }
            : u
        )
      );

      const currentUser = localStorage.getItem("user");
      if (currentUser) {
        const parsed = JSON.parse(currentUser) as any;
        if (parsed.id === userId) {
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...parsed,
              assignedTemplateIds: nextIds,
              assignedTemplateNames: nextNames,
              assignedTemplateId: nextIds[0] ?? null,
              assignedTemplateName: nextNames[0] ?? null,
            })
          );
          useAuthStore.getState().loadFromStorage();
        }
      }

      setFlashMsg({
        type: "success",
        text: `"${selectedTemplate.templateName}" assigned to ${targetUser.name}.`,
      });
    } catch (error) {
      console.error(error);
      setFlashMsg({ type: "error", text: "Assignment failed. Please try again." });
    } finally {
      setAssigningId(null);
    }
  }

  async function handleRemove(userId: string) {
    if (!selectedTemplate) return;

    setRemovingId(userId);

    try {
      const targetUser = users.find((u) => u.id === userId);
      if (!targetUser) throw new Error("User not found");

      const currentIds = Array.isArray(targetUser.assignedTemplateIds)
        ? targetUser.assignedTemplateIds
        : [];

      const currentNames = Array.isArray(targetUser.assignedTemplateNames)
        ? targetUser.assignedTemplateNames
        : [];

      const removeIndex = currentIds.findIndex((id) => id === selectedTemplate.id);

      if (removeIndex === -1) {
        setFlashMsg({ type: "error", text: "This template is not assigned to that user." });
        setRemovingId(null);
        return;
      }

      const nextIds = currentIds.filter((id) => id !== selectedTemplate.id);
      const nextNames = currentNames.filter((_, index) => index !== removeIndex);

      await updateDoc(doc(db, "users", userId), {
        assignedTemplateIds: nextIds,
        assignedTemplateNames: nextNames,

        // keep old fields for compatibility
        assignedTemplateId: nextIds[0] ?? null,
        assignedTemplateName: nextNames[0] ?? null,
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                assignedTemplateIds: nextIds,
                assignedTemplateNames: nextNames,
                assignedTemplateId: nextIds[0] ?? null,
                assignedTemplateName: nextNames[0] ?? null,
              }
            : u
        )
      );

      const currentUser = localStorage.getItem("user");
      if (currentUser) {
        const parsed = JSON.parse(currentUser) as any;
        if (parsed.id === userId) {
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...parsed,
              assignedTemplateIds: nextIds,
              assignedTemplateNames: nextNames,
              assignedTemplateId: nextIds[0] ?? null,
              assignedTemplateName: nextNames[0] ?? null,
            })
          );
          useAuthStore.getState().loadFromStorage();
        }
      }

      setFlashMsg({ type: "success", text: "Template assignment removed." });
    } catch (error) {
      console.error(error);
      setFlashMsg({ type: "error", text: "Failed to remove assignment." });
    } finally {
      setRemovingId(null);
    }
  }

  if (!selectedTemplate) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col items-center justify-center h-64 text-center">
        <LayoutTemplate size={48} className="text-gray-200 mb-3" />
        <p className="text-sm font-semibold text-gray-400">No template selected</p>
        <p className="text-xs text-gray-300 mt-1">Select a template from the list to assign it to users</p>
      </div>
    );
  }

  const assignedUsersCount = users.filter(
    (u) => Array.isArray(u.assignedTemplateIds) && u.assignedTemplateIds.length > 0
  ).length;

  const unassignedUsersCount = users.filter(
    (u) => !Array.isArray(u.assignedTemplateIds) || u.assignedTemplateIds.length === 0
  ).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
      <div>
        <h3 className="text-lg font-bold text-gray-800">Assign to Users</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          {users.length} registered user{users.length !== 1 ? "s" : ""}
        </p>
      </div>

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

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Users", value: users.length, color: "#6366f1" },
          { label: "Assigned", value: assignedUsersCount, color: "#22c55e" },
          { label: "Unassigned", value: unassignedUsersCount, color: "#f59e0b" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-100 p-3 text-center bg-gray-50">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm outline-none bg-gray-50 text-gray-700 focus:border-indigo-300"
        />
      </div>

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

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-300">
              <Users size={40} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">{users.length === 0 ? "No users have signed up yet" : "No users found"}</p>
            </div>
          ) : filteredUsers.map((user) => {
            const templateIds = Array.isArray(user.assignedTemplateIds) ? user.assignedTemplateIds : [];
            const templateNames = Array.isArray(user.assignedTemplateNames) ? user.assignedTemplateNames : [];

            const isAssignedThis = templateIds.includes(selectedTemplate.id);
            const isAssigning = assigningId === user.id;
            const isRemoving = removingId === user.id;

            return (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 rounded-xl border transition-all"
                style={{
                  borderColor: isAssignedThis ? "#a5b4fc" : "#f3f4f6",
                  backgroundColor: isAssignedThis ? "#eef2ff" : "#fafafa",
                }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-indigo-100 text-indigo-600">
                  {user.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>

                  {templateNames.length > 0 && (
                    <p
                      className="text-xs mt-0.5 truncate"
                      style={{ color: isAssignedThis ? "#6366f1" : "#9ca3af" }}
                    >
                      {isAssignedThis
                        ? `✓ This template • Total assigned: ${templateNames.length}`
                        : `→ ${templateNames.join(", ")}`}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isAssignedThis ? (
                    <button
                      onClick={() => handleRemove(user.id)}
                      disabled={isRemoving}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50 transition"
                    >
                      {isRemoving ? (
                        <>
                          <Loader2 size={11} className="animate-spin" />
                          Removing...
                        </>
                      ) : (
                        <>
                          <XCircle size={11} />
                          Remove
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAssign(user.id)}
                      disabled={isAssigning}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                    >
                      {isAssigning ? (
                        <>
                          <Loader2 size={11} className="animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        <>
                          <UserCheck size={11} />
                          Assign
                        </>
                      )}
                    </button>
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
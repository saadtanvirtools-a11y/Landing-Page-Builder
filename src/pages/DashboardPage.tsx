import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import type { UserProject } from "../types";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, refreshUserFromFirestore } = useAuthStore();
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    refreshUserFromFirestore();
  }, [refreshUserFromFirestore]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleOpenEditor = (templateId?: string | null) => {
    const finalTemplateId = templateId ?? user?.assignedTemplateId ?? null;
    if (!finalTemplateId) return;

    navigate("/editor", {
      state: { templateId: finalTemplateId },
    });
  };

  useEffect(() => {
    if (!user?.id) return;

    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const snap = await getDocs(collection(db, "userProjects"));
        const all = snap.docs.map((d) => d.data() as UserProject);
        const mine = all.filter((p) => p.userId === user.id);

        mine.sort((a, b) => {
          const aTime = a.savedAtIso ? new Date(a.savedAtIso).getTime() : 0;
          const bTime = b.savedAtIso ? new Date(b.savedAtIso).getTime() : 0;
          return bTime - aTime;
        });

        setProjects(mine);
      } catch (err) {
        console.error("[Dashboard] Failed to load userProjects:", err);
      } finally {
        setLoadingProjects(false);
      }
    };

    loadProjects();
  }, [user?.id]);

  const formatSaved = (iso?: string) => {
    if (!iso) return "Not saved yet";
    const date = new Date(iso);
    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalProjects = projects.length;
  const latestProject = projects[0] || null;
  const latestSaved = latestProject?.savedAtIso ? formatSaved(latestProject.savedAtIso) : "No saves yet";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Navbar */}
      <nav className="sticky top-0 z-20 border-b border-white/60 bg-white/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <span className="text-white font-bold text-base">LP</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 leading-tight">LP Builder</h1>
              <p className="text-xs text-slate-400 leading-tight">Your workspace dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm text-slate-500">Hello,</p>
              <p className="text-sm font-bold text-slate-800">{user?.name}</p>
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition shadow-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-8 md:p-10 shadow-xl shadow-indigo-100 mb-8">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-72 h-72 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-100 bg-white/10 px-3 py-1.5 rounded-full border border-white/15">
                Welcome back
              </p>

              <h2 className="mt-4 text-3xl md:text-4xl font-extrabold text-white leading-tight">
                {user?.name}, your landing page workspace is ready ✨
              </h2>

              <p className="mt-3 text-sm md:text-base text-indigo-100 max-w-xl leading-relaxed">
                Manage your assigned template, review saved progress, and continue building your page with a cleaner workflow.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {user?.assignedTemplateId && (
                  <button
                    onClick={() => handleOpenEditor(user.assignedTemplateId)}
                    className="px-6 py-3 bg-white text-indigo-700 font-bold rounded-2xl hover:bg-indigo-50 transition shadow-sm"
                  >
                    Open Editor →
                  </button>
                )}

                <div className="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white text-sm">
                  Latest save: <span className="font-semibold">{latestSaved}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 min-w-[280px]">
              <div className="rounded-2xl bg-white/12 border border-white/15 p-4 backdrop-blur-sm">
                <p className="text-indigo-100 text-xs uppercase tracking-wide font-semibold">Assigned</p>
                <p className="mt-2 text-2xl font-extrabold text-white">
                  {user?.assignedTemplateId ? "1" : "0"}
                </p>
                <p className="text-indigo-100 text-xs mt-1">template</p>
              </div>

              <div className="rounded-2xl bg-white/12 border border-white/15 p-4 backdrop-blur-sm">
                <p className="text-indigo-100 text-xs uppercase tracking-wide font-semibold">Saved</p>
                <p className="mt-2 text-2xl font-extrabold text-white">{totalProjects}</p>
                <p className="text-indigo-100 text-xs mt-1">project{totalProjects !== 1 ? "s" : ""}</p>
              </div>

              <div className="rounded-2xl bg-white/12 border border-white/15 p-4 backdrop-blur-sm col-span-2">
                <p className="text-indigo-100 text-xs uppercase tracking-wide font-semibold">Account</p>
                <p className="mt-2 text-lg font-bold text-white">{user?.email}</p>
                <p className="text-indigo-100 text-xs mt-1">Role: {user?.role}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left large column */}
          <div className="xl:col-span-2 space-y-8">
            {/* Assigned Template */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
              <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">
                    Assigned Template
                  </p>
                  <h3 className="mt-2 text-2xl font-extrabold text-slate-800">
                    {user?.assignedTemplateName || "No template assigned"}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 max-w-xl">
                    This is the template currently assigned to your account. Open it to continue editing your page.
                  </p>
                </div>

                {user?.assignedTemplateId && (
                  <button
                    onClick={() => handleOpenEditor(user.assignedTemplateId)}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-2xl hover:from-indigo-700 hover:to-violet-700 transition shadow-sm shrink-0"
                  >
                    Open Editor →
                  </button>
                )}
              </div>

              {user?.assignedTemplateId ? (
                <div className="mt-6 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-indigo-100 flex items-center justify-center text-xl">
                      📄
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-indigo-700 truncate">
                        {user.assignedTemplateName}
                      </p>
                      <p className="text-sm text-slate-500 mt-1 break-all">
                        Template ID: {user.assignedTemplateId}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 text-center py-10 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-5xl mb-4">📋</div>
                  <p className="text-slate-600 font-semibold">No template assigned yet.</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Please contact your admin to assign a template.
                  </p>
                </div>
              )}
            </div>

            {/* Saved Projects */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-500">
                  Saved Projects
                </p>
                <h3 className="mt-2 text-2xl font-extrabold text-slate-800">
                  Your recent saved work
                </h3>
                <p className="text-sm text-slate-500 mt-2">
                  View your saved editor progress below. The main editor action is available from the assigned template card above.
                </p>
              </div>

              {loadingProjects ? (
                <div className="py-14 flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
              ) : projects.length > 0 ? (
                <div className="grid gap-4">
                  {projects.map((project, index) => {
                    const blockCount = project.currentTemplate?.blocks?.length ?? 0;
                    const projectName =
                      project.templateName ||
                      project.currentTemplate?.templateName ||
                      "Untitled Project";

                    return (
                      <div
                        key={project.id}
                        className="rounded-2xl border border-slate-100 bg-gradient-to-r from-slate-50 to-white p-5 hover:border-indigo-200 hover:shadow-sm transition"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
                            {index + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-bold text-slate-800 truncate">
                                {projectName}
                              </p>
                              {index === 0 && (
                                <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-600">
                                  Latest
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">
                                {blockCount} block{blockCount !== 1 ? "s" : ""}
                              </span>
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                                {formatSaved(project.savedAtIso)}
                              </span>
                            </div>

                            <p className="text-xs text-slate-400 mt-3 break-all">
                              Template ID: {project.templateId}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-5xl mb-4">📝</div>
                  <p className="text-slate-600 font-semibold">No saved projects yet.</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Open your assigned template and click save to create your first project.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-8">
            {/* Account Info */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Account Info
              </p>
              <h3 className="mt-2 text-2xl font-extrabold text-slate-800">Profile</h3>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Name</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{user?.name || "N/A"}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Email</p>
                  <p className="mt-1 text-sm font-bold text-slate-800 break-all">{user?.email || "N/A"}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Role</p>
                  <p className="mt-1 text-sm font-bold text-indigo-600 capitalize">{user?.role || "N/A"}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Member Since</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Summary */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl shadow-lg shadow-indigo-100 p-8 text-white">
              <p className="text-xs uppercase tracking-[0.18em] font-bold text-indigo-100">
                Quick Summary
              </p>
              <h3 className="mt-2 text-2xl font-extrabold">Workspace Status</h3>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
                  <span className="text-sm text-indigo-100">Assigned Template</span>
                  <span className="text-sm font-bold">{user?.assignedTemplateId ? "Available" : "None"}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
                  <span className="text-sm text-indigo-100">Saved Projects</span>
                  <span className="text-sm font-bold">{projects.length}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
                  <span className="text-sm text-indigo-100">Last Activity</span>
                  <span className="text-sm font-bold text-right">{latestSaved}</span>
                </div>
              </div>

              {user?.assignedTemplateId && (
                <button
                  onClick={() => handleOpenEditor(user.assignedTemplateId)}
                  className="mt-6 w-full py-3 rounded-2xl bg-white text-indigo-700 font-bold hover:bg-indigo-50 transition"
                >
                  Continue Working
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
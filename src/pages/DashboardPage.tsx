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
      {/* Top Nav */}
      <nav className="sticky top-0 z-20 border-b border-indigo-100 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm tracking-wide">LP</span>
            </div>

            <div>
              <h1 className="text-lg font-semibold text-indigo-950 leading-tight">LP Builder</h1>
              <p className="text-xs text-indigo-400 leading-tight">Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-xs text-indigo-400">Signed in as</p>
              <p className="text-sm font-semibold text-indigo-950">{user?.name}</p>
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2.5 rounded-xl border border-indigo-200 bg-white text-indigo-700 text-sm font-medium hover:bg-indigo-50 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Hero / Intro */}
        <div className="rounded-[28px] border border-indigo-100 bg-white shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr]">
            <div className="px-8 md:px-10 py-10 md:py-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                Workspace Overview
              </div>

              <h2 className="mt-5 text-3xl md:text-4xl font-semibold tracking-tight text-indigo-950 leading-tight">
                Welcome back, {user?.name}
              </h2>

              <p className="mt-4 max-w-2xl text-sm md:text-base leading-7 text-slate-600">
                Access your assigned template, review your latest saved work, and continue editing with a cleaner workflow built for day-to-day use.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {user?.assignedTemplateId ? (
                  <button
                    onClick={() => handleOpenEditor(user.assignedTemplateId)}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 transition"
                  >
                    Open Editor
                  </button>
                ) : (
                  <div className="px-5 py-3 rounded-2xl bg-indigo-50 text-indigo-400 text-sm font-medium">
                    No template assigned
                  </div>
                )}

                <div className="px-4 py-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 text-sm text-slate-600">
                  Latest save: <span className="font-semibold text-indigo-900">{latestSaved}</span>
                </div>
              </div>
            </div>

            <div className="border-t lg:border-t-0 lg:border-l border-indigo-100 bg-indigo-50/50 px-8 py-8 md:px-10 md:py-10">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-500">
                Snapshot
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4">
                <div className="rounded-2xl border border-indigo-100 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-indigo-500 font-medium">Assigned Template</p>
                  <p className="mt-2 text-2xl font-semibold text-indigo-950">
                    {user?.assignedTemplateId ? "1" : "0"}
                  </p>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-indigo-500 font-medium">Saved Projects</p>
                  <p className="mt-2 text-2xl font-semibold text-indigo-950">{totalProjects}</p>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-indigo-500 font-medium">Role</p>
                  <p className="mt-2 text-base font-semibold capitalize text-indigo-950">{user?.role || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left */}
          <div className="xl:col-span-2 space-y-8">
            {/* Assigned Template */}
            <section className="rounded-[28px] border border-indigo-100 bg-white shadow-sm p-8">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-500">
                    Assigned Template
                  </p>

                  <h3 className="mt-3 text-2xl font-semibold text-indigo-950">
                    {user?.assignedTemplateName || "No template assigned"}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600 max-w-xl">
                    This is the template currently linked to your account. Open it to continue editing your landing page.
                  </p>
                </div>

                {user?.assignedTemplateId && (
                  <button
                    onClick={() => handleOpenEditor(user.assignedTemplateId)}
                    className="shrink-0 px-5 py-3 rounded-2xl border border-indigo-600 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 transition"
                  >
                    Open Editor
                  </button>
                )}
              </div>

              {user?.assignedTemplateId ? (
                <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl border border-indigo-100 bg-white flex items-center justify-center text-lg shadow-sm">
                      📄
                    </div>

                    <div className="min-w-0">
                      <p className="text-base font-semibold text-indigo-950 truncate">
                        {user.assignedTemplateName}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 break-all">
                        Template ID: {user.assignedTemplateId}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-indigo-100 bg-indigo-50/50 py-10 px-6 text-center">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-indigo-900 font-medium">No template assigned yet</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Please contact your admin to assign a template.
                  </p>
                </div>
              )}
            </section>

            {/* Saved Projects */}
            <section className="rounded-[28px] border border-indigo-100 bg-white shadow-sm p-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-500">
                  Saved Projects
                </p>

                <h3 className="mt-3 text-2xl font-semibold text-indigo-950">
                  Recent work
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Review your most recent saved editor states below. The main action to continue editing remains in the assigned template section above.
                </p>
              </div>

              {loadingProjects ? (
                <div className="py-14 flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
              ) : projects.length > 0 ? (
                <div className="mt-6 grid gap-4">
                  {projects.map((project, index) => {
                    const blockCount = project.currentTemplate?.blocks?.length ?? 0;
                    const projectName =
                      project.templateName ||
                      project.currentTemplate?.templateName ||
                      "Untitled Project";

                    return (
                      <div
                        key={project.id}
                        className="rounded-2xl border border-indigo-100 bg-white p-5 hover:border-indigo-200 hover:shadow-sm transition"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 rounded-2xl border border-indigo-100 bg-indigo-50 flex items-center justify-center text-sm font-semibold text-indigo-700 shrink-0">
                            {index + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-indigo-950 truncate">
                                {projectName}
                              </p>

                              {index === 0 && (
                                <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  Latest
                                </span>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                                {blockCount} block{blockCount !== 1 ? "s" : ""}
                              </span>

                              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">
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
                <div className="mt-6 rounded-2xl border border-dashed border-indigo-100 bg-indigo-50/50 py-12 px-6 text-center">
                  <div className="text-4xl mb-3">📝</div>
                  <p className="text-indigo-900 font-medium">No saved projects yet</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Open your assigned template and click save to create your first project.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Right */}
          <div className="space-y-8">
            {/* Account Info */}
            <section className="rounded-[28px] border border-indigo-100 bg-white shadow-sm p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-500">
                Account Info
              </p>

              <h3 className="mt-3 text-2xl font-semibold text-indigo-950">
                Profile
              </h3>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Name</p>
                  <p className="mt-1 text-sm font-semibold text-indigo-950">{user?.name || "N/A"}</p>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Email</p>
                  <p className="mt-1 text-sm font-semibold text-indigo-950 break-all">{user?.email || "N/A"}</p>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Role</p>
                  <p className="mt-1 text-sm font-semibold text-indigo-950 capitalize">{user?.role || "N/A"}</p>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Member Since</p>
                  <p className="mt-1 text-sm font-semibold text-indigo-950">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                  </p>
                </div>
              </div>
            </section>

            {/* Summary */}
            <section className="rounded-[28px] border border-indigo-100 bg-gradient-to-br from-indigo-600 to-violet-600 shadow-sm p-8 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-100">
                Summary
              </p>

              <h3 className="mt-3 text-2xl font-semibold text-white">
                Workspace Status
              </h3>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <span className="text-sm text-indigo-100">Assigned Template</span>
                  <span className="text-sm font-semibold text-white">
                    {user?.assignedTemplateId ? "Available" : "None"}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <span className="text-sm text-indigo-100">Saved Projects</span>
                  <span className="text-sm font-semibold text-white">{projects.length}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3 gap-3">
                  <span className="text-sm text-indigo-100">Last Activity</span>
                  <span className="text-sm font-semibold text-white text-right">{latestSaved}</span>
                </div>
              </div>

              {user?.assignedTemplateId && (
                <button
                  onClick={() => handleOpenEditor(user.assignedTemplateId)}
                  className="mt-6 w-full py-3 rounded-2xl bg-white text-indigo-700 text-sm font-semibold hover:bg-indigo-50 transition"
                >
                  Continue Working
                </button>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
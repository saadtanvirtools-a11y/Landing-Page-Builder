import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function DashboardPage() {
  const navigate         = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ── Navigate to editor with templateId in route state ──
  // EditorPage will read location.state.templateId on mount
  const handleOpenEditor = () => {
    if (user?.assignedTemplateId) {
      navigate('/editor', {
        state: { templateId: user.assignedTemplateId },
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Navbar ───────────────────────────── */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4
                      flex items-center justify-between">
        <h1 className="text-xl font-bold text-indigo-600">
          🚀 LP Builder
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Hello, <strong>{user?.name}</strong>
          </span>
          <button
            onClick={handleLogout}
            className="text-sm px-4 py-2 bg-red-500 text-white
                       rounded-lg hover:bg-red-600 transition"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* ── Main Content ─────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Welcome Card */}
        <div className="bg-white rounded-2xl shadow p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            Welcome back, {user?.name}! 👋
          </h2>
          <p className="text-gray-500 mt-2">
            Build and customize your landing page below.
          </p>
        </div>

        {/* Template Card */}
        <div className="bg-white rounded-2xl shadow p-8 mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Your Assigned Template
          </h3>

          {user?.assignedTemplateId ? (
            /* ── Template IS assigned ── */
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-600 font-medium">
                  {user.assignedTemplateName}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Template ID: {user.assignedTemplateId}
                </p>
              </div>
              <button
                onClick={handleOpenEditor}
                className="px-6 py-2.5 bg-indigo-600 text-white font-semibold
                           rounded-lg hover:bg-indigo-700 transition"
              >
                Open Editor →
              </button>
            </div>
          ) : (
            /* ── No template assigned ── */
            <div className="text-center py-6">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-gray-500 font-medium">
                No template assigned yet.
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Please contact your admin to assign a template.
              </p>
              {/* ✅ No "Open Editor Anyway" button — nothing to show */}
            </div>
          )}
        </div>

        {/* Account Info Card */}
        <div className="bg-white rounded-2xl shadow p-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            Account Info
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Name</span>
              <span className="text-gray-800 font-medium">{user?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Email</span>
              <span className="text-gray-800 font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Role</span>
              <span className="capitalize text-indigo-600 font-medium">
                {user?.role}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Member Since</span>
              <span className="text-gray-800 font-medium">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
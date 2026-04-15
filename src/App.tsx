import { useEffect }                        from 'react';
import { BrowserRouter, Routes, Route,
         Navigate }                          from 'react-router-dom';
import { useAuthStore }                      from './store/authStore';
import ProtectedRoute                        from './router/ProtectedRoute';

// ── Pages ──────────────────────────────────────
import LoginPage      from './pages/auth/LoginPage';
import SignupPage     from './pages/auth/SignupPage';
import DashboardPage  from './pages/DashboardPage';
import EditorPage     from './pages/EditorPage';
import AdminPage      from './pages/admin/AdminPage';
import NotFoundPage   from './pages/NotFoundPage';
import PreviewPage    from './pages/PreviewPage';

export default function App() {
  const { loadFromStorage } = useAuthStore();

  // ── Restore session on app load ──────────────
  useEffect(() => {
    loadFromStorage();
  }, []);

  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public Routes ──────────────────── */}
        <Route path="/login"  element={<LoginPage />}  />
        <Route path="/signup" element={<SignupPage />} />

        {/* ── Protected: User Routes ─────────── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/editor"
          element={
            <ProtectedRoute>
              <EditorPage />
            </ProtectedRoute>
          }
        />

        {/* ── Protected: Preview ─────────────── */}
        <Route
          path="/preview"
          element={
            <ProtectedRoute>
              <PreviewPage />
            </ProtectedRoute>
          }
        />

        {/* ── Protected: Admin Only ──────────── */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        {/* ── Redirects ──────────────────────── */}
        <Route path="/"   element={<Navigate to="/login" replace />} />
        <Route path="*"   element={<NotFoundPage />}                 />

      </Routes>
    </BrowserRouter>
  );
}
import { Navigate } from 'react-router-dom';

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  // No token → redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Parse user from localStorage
  const user = userStr ? JSON.parse(userStr) : null;

  // Not an admin → redirect to 403
  if (!user || user.role !== 'admin') {
    return <Navigate to="/403" replace />;
  }

  // Is admin → render the page
  return <>{children}</>;
}

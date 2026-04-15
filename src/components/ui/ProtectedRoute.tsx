import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  // Check if JWT token exists in localStorage
  const token = localStorage.getItem('token');

  // If no token → redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Token exists → render the page
  return <>{children}</>;
}

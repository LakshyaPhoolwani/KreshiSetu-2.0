import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading" data-testid="auth-loading">Checking your session…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <div className="loading" data-testid="role-forbidden">This section is not available for your role ({user.role}).</div>;
  return children;
}

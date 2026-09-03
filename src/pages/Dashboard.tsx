import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'PROVIDER') return <Navigate to="/provider" replace />;
  if (user.role === 'PATIENT') return <Navigate to="/patient" replace />;
  return <Navigate to="/verify" replace />;
}

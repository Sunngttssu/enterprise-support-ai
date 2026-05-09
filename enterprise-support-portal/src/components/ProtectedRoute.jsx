import { useState } from 'react';
import AdminLogin from './AdminLogin';

/**
 * ProtectedRoute
 * Checks sessionStorage for the admin auth flag.
 * Renders <AdminLogin> until the user authenticates,
 * then renders children (the actual AdminDashboard).
 */
export default function ProtectedRoute({ children }) {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem('isAdminAuthenticated') === 'true'
  );

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />;
  }

  return children;
}

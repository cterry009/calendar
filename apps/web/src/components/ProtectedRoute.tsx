import { Navigate, Outlet } from 'react-router-dom';
import { Paragraph, YStack } from '@calendar/ui';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <YStack minHeight="100vh" alignItems="center" justifyContent="center" padding="$6">
        <Paragraph color="$muted">Loading session...</Paragraph>
      </YStack>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

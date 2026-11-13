import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { AuthPage } from './pages/AuthPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { TablePage } from './pages/TablePage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center-screen muted">Carregando…</div>;
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<AuthPage />} />
      <Route
        path="/campanhas"
        element={
          <RequireAuth>
            <CampaignsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/mesa/:campaignId"
        element={
          <RequireAuth>
            <TablePage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/campanhas" replace />} />
    </Routes>
  );
}

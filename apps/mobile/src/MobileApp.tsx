import type { ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@web/auth';
import { AuthPage } from '@web/pages/AuthPage';
import { CampaignsPage } from '@web/pages/CampaignsPage';
import { ConnectPage } from './ConnectPage';
import { MobileTablePage } from './MobileTablePage';
import { getSavedServer } from './server';

function RequireServer({ children }: { children: ReactNode }) {
  if (!getSavedServer()) return <Navigate to="/conectar" replace />;
  return <>{children}</>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center-screen muted">Carregando…</div>;
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/** Faixa no topo com o servidor atual (fora da mesa). */
function ServerBar() {
  const server = getSavedServer();
  if (!server) return null;
  return (
    <div className="server-bar">
      <span className="muted small grow">Servidor: {server.replace(/^https?:\/\//, '')}</span>
      <Link to="/conectar" className="small">
        trocar
      </Link>
    </div>
  );
}

export function MobileApp() {
  return (
    <Routes>
      <Route path="/conectar" element={<ConnectPage />} />
      <Route
        path="/entrar"
        element={
          <RequireServer>
            <ServerBar />
            <AuthPage />
          </RequireServer>
        }
      />
      <Route
        path="/campanhas"
        element={
          <RequireServer>
            <RequireAuth>
              <ServerBar />
              <CampaignsPage />
            </RequireAuth>
          </RequireServer>
        }
      />
      <Route
        path="/mesa/:campaignId"
        element={
          <RequireServer>
            <RequireAuth>
              <MobileTablePage />
            </RequireAuth>
          </RequireServer>
        }
      />
      <Route path="*" element={<Navigate to={getSavedServer() ? '/campanhas' : '/conectar'} replace />} />
    </Routes>
  );
}

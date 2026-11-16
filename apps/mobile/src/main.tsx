import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { setApiBase } from '@web/api';
import { AuthProvider } from '@web/auth';
import { ErrorBoundary } from '@web/components/ErrorBoundary';
import '@web/styles.css';
import '@web/table.css';
import { MobileApp } from './MobileApp';
import './mobile.css';
import { getSavedServer } from './server';

// O endereço do servidor precisa estar definido antes do AuthProvider validar a sessão.
setApiBase(getSavedServer() ?? '');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ErrorBoundary>
          <MobileApp />
        </ErrorBoundary>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);

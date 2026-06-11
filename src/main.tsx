import React, { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { useAuthStore } from './stores/useAuthStore';

const AuthStoreInitializer = ({ children }: { children: React.ReactNode }) => {
  const initialize = useAuthStore((s) => s.initialize);
  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);
  return <>{children}</>;
};

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento #root en index.html');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthStoreInitializer>
        <App />
      </AuthStoreInitializer>
    </BrowserRouter>
  </StrictMode>,
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';
import { theme } from './theme';
import './index.css';

const applyThemeVariables = () => {
  const root = document.documentElement;

  // Keep legacy CSS variable names while sourcing all values from shared theme tokens.
  root.style.setProperty('--brand-900', theme.headerBg);
  root.style.setProperty('--brand-800', theme.primaryDark);
  root.style.setProperty('--brand-700', theme.primary);
  root.style.setProperty('--brand-600', theme.secondary);
  root.style.setProperty('--brand-100', theme.primaryLight);
  root.style.setProperty('--brand-50', theme.primaryExtraLight);

  root.style.setProperty('--bg-canvas', theme.background);
  root.style.setProperty('--bg-elevated', theme.cardBg);
  root.style.setProperty('--bg-soft', theme.surfaceAlt);

  root.style.setProperty('--text-strong', theme.textPrimary);
  root.style.setProperty('--text-muted', theme.textSecondary);
  root.style.setProperty('--text-tertiary', theme.textTertiary);

  root.style.setProperty('--border-subtle', theme.borderColor);
  root.style.setProperty('--border-strong', theme.borderColorDark);
  root.style.setProperty('--divider', theme.divider);
  root.style.setProperty('--text-on-primary', theme.textOnPrimary);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-soft', theme.accentLight);

  root.style.setProperty('--success', theme.success);
  root.style.setProperty('--danger', theme.error);
  root.style.setProperty('--warning', theme.warning);
  root.style.setProperty('--info', theme.info);
};

applyThemeVariables();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

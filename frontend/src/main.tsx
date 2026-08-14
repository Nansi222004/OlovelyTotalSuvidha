import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/anti-flash.css'

// Set background immediately to prevent flash
if (document.documentElement) {
  document.documentElement.style.backgroundColor = '#ffffff';
}

// Handle Vite dynamic import / asset preload errors caused by new deployments
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const lastReload = Number(sessionStorage.getItem('chunk_reload_ts') || '0');
  if (Date.now() - lastReload > 10000) {
    sessionStorage.setItem('chunk_reload_ts', String(Date.now()));
    window.location.reload();
  }
});

// Handle unhandled Promise rejections for dynamic module imports
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const errStr = (
    typeof reason === 'string'
      ? reason
      : reason?.message || reason?.stack || String(reason || '')
  ).toLowerCase();

  if (
    errStr.includes('dynamically imported module') ||
    errStr.includes('failed to fetch') ||
    errStr.includes('loading chunk') ||
    errStr.includes('chunkloaderror') ||
    errStr.includes('failed to load module script')
  ) {
    console.warn('[Global] Dynamic import failure detected:', reason);
    const lastReload = Number(sessionStorage.getItem('chunk_reload_ts') || '0');
    if (Date.now() - lastReload > 10000) {
      sessionStorage.setItem('chunk_reload_ts', String(Date.now()));
      window.location.reload();
    }
  }
});


const rootElement = document.getElementById('root');
if (rootElement) {
  rootElement.style.backgroundColor = '#ffffff';
}

ReactDOM.createRoot(rootElement!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


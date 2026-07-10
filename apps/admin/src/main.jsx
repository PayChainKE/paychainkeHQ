import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// The offline-caching service worker is only useful (and only registered) in
// production. In dev it actively fights Vite's module reloading — a
// stale-while-revalidate cache will keep serving yesterday's JS after every
// edit. Registering it here (instead of a raw <script> in index.html) lets us
// gate on import.meta.env.PROD and, in dev, proactively unregister anything
// left over from a previous production-mode visit to this origin.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('Admin SW registered: ', registration);
      }).catch((registrationError) => {
        console.log('Admin SW registration failed: ', registrationError);
      });
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
    if (window.caches) {
      caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
    }
  }
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);

import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App'; // App.tsx now exports 'App' as a named component.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const Root: React.FC = () => {
  return <App />;
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

// Service Worker registration (bara i produktion)
if ((import.meta as any).env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // När en NY SW-version hittas
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            // Om ny SW är installerad och vi redan har en controller → uppdatering
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Be nya SW:n ta över direkt
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => console.error('Service Worker registration failed:', err));
  });

  // När kontrollen byts till nya SW → ladda om en gång
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloaded) {
      reloaded = true;
      window.location.reload();
    }
  });
}
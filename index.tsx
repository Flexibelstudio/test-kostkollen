import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App'; // App.tsx now exports 'App' as a named component.
import { UserProvider } from './context/UserContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const Root: React.FC = () => {
  return (
    <UserProvider>
      <App />
    </UserProvider>
  );
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
        // Webblasaren letar efter en ny sw.js bara nar sidan laddas. Den som
        // har appen installerad och bara vaxlar in och ut ur den kan darfor
        // ligga kvar pa en gammal version i dagar. Vi ber darfor aktivt om en
        // koll varje gang appen kommer i forgrunden - det ar ocksa det
        // sakraste tillfallet att ladda om, eftersom anvandaren just kommit
        // tillbaka och inte star mitt i ett formular.
        let lastUpdateCheck = Date.now();
        const MIN_MS_BETWEEN_CHECKS = 15 * 60 * 1000;

        const checkForUpdate = () => {
          if (document.visibilityState !== 'visible') return;
          if (Date.now() - lastUpdateCheck < MIN_MS_BETWEEN_CHECKS) return;
          lastUpdateCheck = Date.now();
          reg.update().catch(() => { /* offline - forsok igen nasta gang */ });
        };

        document.addEventListener('visibilitychange', checkForUpdate);
        window.addEventListener('focus', checkForUpdate);
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

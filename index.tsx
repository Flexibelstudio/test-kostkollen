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
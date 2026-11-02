import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/ui';
import { initAppearance } from './lib/appearance';
import './index.css';

initAppearance(); // colours before the first paint

const syncVisibility = () => document.documentElement.classList.toggle('tab-hidden', document.hidden);
document.addEventListener('visibilitychange', syncVisibility);
syncVisibility();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

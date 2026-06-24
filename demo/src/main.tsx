/// <reference types="vite/client" />
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Theme is selected deterministically via the `?theme=dark` query param so the
// visual spec can baseline light + dark without any UI interaction. @coston/ui
// dark mode is driven by the `dark` class on <html>, not OS colorScheme.
if (new URLSearchParams(window.location.search).get('theme') === 'dark') {
  document.documentElement.classList.add('dark');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

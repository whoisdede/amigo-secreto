import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Mantém aria-invalid sincronizado com o estado visual :user-invalid (acessibilidade)
const syncAria = (el: EventTarget | null) => {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    el.setAttribute('aria-invalid', el.matches(':user-invalid') ? 'true' : 'false');
  }
};
document.addEventListener('blur', (e) => syncAria(e.target), true);
document.addEventListener('input', (e) => {
  if ((e.target as Element).hasAttribute?.('aria-invalid')) syncAria(e.target);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LucideProvider } from 'lucide-react';
import App from './App';
import { installGlobalErrorReporting } from './lib/errorReporter';

installGlobalErrorReporting();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LucideProvider size={20} strokeWidth={1.6}>
      <App />
    </LucideProvider>
  </StrictMode>,
);

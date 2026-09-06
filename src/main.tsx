import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Experience } from './Experience';
import './styles.css';
import './lantern/lantern.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Missing #root element');
}

createRoot(root).render(
  <StrictMode>
    <Experience />
  </StrictMode>,
);

import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';
import { installDomPatch } from './lib/domPatch';

import './index.css';

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim();
if (apiBaseUrl) {
  setBaseUrl(apiBaseUrl);
}

installDomPatch();

createRoot(document.getElementById('root')!).render(<App />);

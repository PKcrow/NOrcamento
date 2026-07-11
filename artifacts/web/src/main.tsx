import { createRoot } from 'react-dom/client';

import App from './App';
import { installDomPatch } from './lib/domPatch';

import './index.css';

installDomPatch();

createRoot(document.getElementById('root')!).render(<App />);

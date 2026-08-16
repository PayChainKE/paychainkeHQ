import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './lib/sentry';

const root = createRoot(document.getElementById('root'));
root.render(<App />);

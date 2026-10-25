import React from 'react';
import { createRoot } from 'react-dom/client';
import Cluster from './Cluster.jsx';
import '../styles.css';
import '../themes.css';
import '../fx.css';
import './cluster.css';
import { applySavedTheme } from '../theme.js';

applySavedTheme();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Cluster />
  </React.StrictMode>,
);

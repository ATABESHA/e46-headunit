import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Cluster from './cluster/Cluster.jsx';
import './styles.css';
import './themes.css';
import './homes.css';
import './fx.css';
import './cluster/cluster.css';
import { applySavedTheme } from './theme.js';
import { useView } from './view.js';

applySavedTheme();

/** This window shows the head unit, or the cluster after the swap button (one screen). */
function Root() {
  const [view] = useView();
  return view === 'cluster' ? <Cluster swappable /> : <App />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);

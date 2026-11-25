/**
 * src/index.jsx
 *
 * Main entry point for React BINGO Application.
 * Boots the full React application at #app-root with a Global ErrorBoundary
 * guaranteeing zero blank screens.
 * Also exports BingoGame, TournamentRouter, and test mounting helpers.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { BingoGame } from './components/BingoGame.jsx';
import { TournamentRouter } from './tournaments/TournamentRouter.jsx';
import { StrikeThroughOverlay } from './components/StrikeThroughOverlay.jsx';
import './styles/bingo.css';
import './styles/tournaments.css';
import './styles/sportsTheme.css';

if (typeof window !== 'undefined') {
  window.__REACT_APP_ACTIVE__ = true;
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unexpected rendering error' };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '80dvh', padding: '24px', textAlign: 'center', color: '#F4F6FA'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛠️</div>
          <h2 style={{ margin: '0 0 8px' }}>Something went wrong</h2>
          <p style={{ margin: '0 0 16px', color: '#8995A8', maxWidth: '420px', fontSize: '0.9rem' }}>
            {this.state.errorMessage}
          </p>
          <button
            type="button"
            className="btn-tactile btn-primary"
            onClick={() => {
              this.setState({ hasError: false, errorMessage: '' });
              if (typeof window !== 'undefined') window.location.href = '/';
            }}
          >
            Return to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

let appRoot = null;
let bingoRoot = null;
let tournamentRoot = null;

export function mountApp(container, props = {}) {
  if (!container) return null;
  if (!appRoot) {
    appRoot = createRoot(container);
  }
  appRoot.render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App {...props} />
      </AppErrorBoundary>
    </React.StrictMode>
  );
  return appRoot;
}

export function mountBingoGame(container, props = {}) {
  if (!container) return null;
  if (!bingoRoot) {
    bingoRoot = createRoot(container);
  }
  bingoRoot.render(
    <React.StrictMode>
      <BingoGame {...props} />
    </React.StrictMode>
  );
  return bingoRoot;
}

export function unmountBingoGame() {
  if (bingoRoot) {
    bingoRoot.unmount();
    bingoRoot = null;
  }
}

export function mountTournamentApp(container, props = {}) {
  if (!container) return null;
  if (!tournamentRoot) {
    tournamentRoot = createRoot(container);
  }
  tournamentRoot.render(
    <React.StrictMode>
      <TournamentRouter {...props} />
    </React.StrictMode>
  );
  return tournamentRoot;
}

export function unmountTournamentApp() {
  if (tournamentRoot) {
    tournamentRoot.unmount();
    tournamentRoot = null;
  }
}

export { App, BingoGame, TournamentRouter, StrikeThroughOverlay };

function boot() {
  const container = document.getElementById('app-root') || document.getElementById('root');
  if (container) {
    mountApp(container);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

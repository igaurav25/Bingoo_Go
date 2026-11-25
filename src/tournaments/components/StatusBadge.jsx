/**
 * src/tournaments/components/StatusBadge.jsx
 * 
 * Accessible Match and Tournament Status Badge.
 * Match states: scheduled, waiting for players, ready, live, finished, walkover, bye.
 * Tournament states: registering, in_progress, playoffs, completed, cancelled.
 * Never relies on color alone; always pairs with icon and text.
 */

import React from 'react';

export function StatusBadge({ status = 'scheduled', size = 'default' }) {
  const norm = (status || 'scheduled').toLowerCase();

  const configMap = {
    // Match statuses
    scheduled: { label: 'Scheduled', icon: '⏱️', className: 'status-scheduled' },
    waiting: { label: 'Waiting', icon: '⏳', className: 'status-waiting' },
    ready: { label: 'Ready', icon: '⚡', className: 'status-ready' },
    live: { label: 'Live', icon: '🔴', className: 'status-live pulse-ring' },
    in_progress: { label: 'Live', icon: '🔴', className: 'status-live pulse-ring' },
    finished: { label: 'Finished', icon: '🏁', className: 'status-finished' },
    completed: { label: 'Completed', icon: '🏆', className: 'status-completed' },
    walkover: { label: 'Walkover', icon: '🏳️', className: 'status-walkover' },
    bye: { label: 'Bye', icon: '⏩', className: 'status-bye' },

    // Tournament statuses
    pending: { label: 'Registering', icon: '🟢', className: 'status-open' },
    open: { label: 'Registering', icon: '🟢', className: 'status-open' },
    registering: { label: 'Open', icon: '🟢', className: 'status-open' },
    playoffs: { label: 'Playoffs', icon: '🥊', className: 'status-playoffs' },
    cancelled: { label: 'Cancelled', icon: '❌', className: 'status-cancelled' }
  };

  const item = configMap[norm] || { label: status, icon: 'ℹ️', className: 'status-default' };

  return (
    <span
      className={`tournament-status-badge ${item.className} ${size === 'small' ? 'badge-sm' : ''}`}
      role="status"
    >
      <span className="status-badge-icon" aria-hidden="true">{item.icon}</span>
      <span className="status-badge-text">{item.label}</span>
    </span>
  );
}

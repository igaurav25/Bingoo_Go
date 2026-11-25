/**
 * src/tournaments/screens/TournamentJoin.jsx
 * 
 * Tournament Join Screen (/tournaments/join/:code?).
 * Allows entering room/tournament code with instant uppercase formatting,
 * previewing tournament details, reviewing a confirmation modal before finalizing,
 * and joining with clear server error feedback.
 */

import React, { useState, useEffect, useRef } from 'react';
import { PageShell } from '../components/PageShell.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { Num } from '../components/Num.jsx';
import { socketClient } from '../../services/socketClient.js';

function extractTournamentCode(rawInput = '') {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return '';
  try {
    if (trimmed.includes('/tournaments/join/')) {
      const seg = trimmed.split('/tournaments/join/')[1] || '';
      return seg.split(/[?#/\s]/)[0].toUpperCase();
    }
    if (trimmed.includes('code=')) {
      const u = new URL(trimmed.startsWith('http') ? trimmed : `https://local.host/${trimmed}`);
      const c = u.searchParams.get('code');
      if (c) return c.trim().toUpperCase();
    }
  } catch {
    // Fallback to raw trimmed code
  }
  return trimmed.toUpperCase();
}

export function TournamentJoin({
  initialCode = '',
  currentUserId = null,
  currentUserName = 'Guest Player',
  onJoinTournament = null,
  onNavigate = null
}) {
  const [code, setCode] = useState(extractTournamentCode(initialCode));
  const [isLoading, setIsLoading] = useState(false);
  const [previewTournament, setPreviewTournament] = useState(null);
  const [error, setError] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('');
  const [linkPasteInput, setLinkPasteInput] = useState('');

  const joinLockRef = useRef(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Fetch preview when code reaches valid length (>= 3 chars)
  useEffect(() => {
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length >= 3) {
      let isMounted = true;
      fetch(`/api/tournaments?code=${encodeURIComponent(cleanCode)}`)
        .then(res => res.json())
        .then(data => {
          if (!isMounted) return;
          if (data.success && data.tournaments?.length > 0) {
            setPreviewTournament(data.tournaments[0]);
            setError(null);
          } else {
            setPreviewTournament(null);
          }
        })
        .catch(() => {
          if (isMounted) setPreviewTournament(null);
        });

      return () => { isMounted = false; };
    } else {
      setPreviewTournament(null);
      setError(null);
    }
  }, [code]);

  const stopCameraScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!showScannerModal) {
      stopCameraScanner();
      return;
    }
    let cancelled = false;
    let scanTimer = null;

    async function startCamera() {
      const hasMedia = typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia;
      const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
      if (!hasMedia) {
        setScannerStatus('Camera is not accessible in this browser. Upload a QR screenshot or paste the joining link below.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        if (!hasDetector) {
          setScannerStatus('Camera active. Auto-decoding requires BarcodeDetector support — paste the tournament link or upload QR image below.');
          return;
        }
        setScannerStatus('Point your camera at a tournament QR code...');
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const scanFrame = async () => {
          if (cancelled || !videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const extracted = extractTournamentCode(barcodes[0].rawValue);
              if (extracted) {
                setCode(extracted);
                setShowScannerModal(false);
                stopCameraScanner();
                return;
              }
            }
          } catch {
            // Keep scanning
          }
          if (!cancelled) scanTimer = setTimeout(scanFrame, 350);
        };
        scanTimer = setTimeout(scanFrame, 350);
      } catch {
        if (!cancelled) {
          setScannerStatus('Camera permission denied or unavailable. Upload a QR image or paste the tournament link/code below.');
        }
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      if (scanTimer) clearTimeout(scanTimer);
      stopCameraScanner();
    };
  }, [showScannerModal]);

  const handleQrImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
      setScannerStatus('Browser QR image decoding unavailable here. Paste the tournament link or code below.');
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const results = await detector.detect(bitmap);
      if (results && results.length > 0) {
        const extracted = extractTournamentCode(results[0].rawValue);
        if (extracted) {
          setCode(extracted);
          setShowScannerModal(false);
          return;
        }
      }
      setScannerStatus('No QR code detected in that image.');
    } catch {
      setScannerStatus('Could not read QR code from that image.');
    }
  };

  // Evaluate join eligibility on previewed tournament
  const isAlreadyJoined = Boolean(
    previewTournament &&
    currentUserId &&
    (previewTournament.participants || []).some(p => p.id === currentUserId)
  );
  const deadlineMs = previewTournament?.registrationDeadline ? new Date(previewTournament.registrationDeadline).getTime() : null;
  const isDeadlinePassed = Boolean(deadlineMs && Number.isFinite(deadlineMs) && Date.now() > deadlineMs);

  // Open confirmation modal or fetch preview if not yet fetched
  const handleInitiateJoin = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = extractTournamentCode(code);
    if (!cleanCode) {
      setError('Please enter a tournament code or invite link');
      return;
    }

    if (previewTournament) {
      if (isAlreadyJoined) {
        if (onNavigate) onNavigate(`/tournaments/${previewTournament.id}`);
        return;
      }
      if (previewTournament.status !== 'REGISTERING') {
        setError(`Registration is closed for "${previewTournament.name}" (${previewTournament.status}).`);
        return;
      }
      if (isDeadlinePassed) {
        setError(`Registration deadline has passed for "${previewTournament.name}".`);
        return;
      }
      const count = previewTournament.participants?.length || 0;
      const max = previewTournament.maxPlayers || previewTournament.maxParticipants || 8;
      if (count >= max) {
        setError(`Tournament "${previewTournament.name}" is already full (${count}/${max} players).`);
        return;
      }
      setShowConfirmModal(true);
      return;
    }

    // Try fetching preview immediately before confirming
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments?code=${encodeURIComponent(cleanCode)}`);
      const data = await res.json();
      if (data.success && data.tournaments?.length > 0) {
        const found = data.tournaments[0];
        setPreviewTournament(found);
        const already = currentUserId && (found.participants || []).some(p => p.id === currentUserId);
        if (already) {
          if (onNavigate) onNavigate(`/tournaments/${found.id}`);
          return;
        }
        const dl = found.registrationDeadline ? new Date(found.registrationDeadline).getTime() : null;
        if (found.status !== 'REGISTERING') {
          setError(`Registration is closed for "${found.name}" (${found.status}).`);
          return;
        }
        if (dl && Number.isFinite(dl) && Date.now() > dl) {
          setError(`Registration deadline has passed for "${found.name}".`);
          return;
        }
        const count = found.participants?.length || 0;
        const max = found.maxPlayers || found.maxParticipants || 8;
        if (count >= max) {
          setError(`Tournament "${found.name}" is already full (${count}/${max} players).`);
        } else {
          setShowConfirmModal(true);
        }
      } else {
        setError(`No active tournament found with code "${cleanCode}". Please verify and try again.`);
      }
    } catch (err) {
      setError(err.message || 'Error looking up tournament code');
    } finally {
      setIsLoading(false);
    }
  };

  // Perform actual join request
  const handleConfirmJoin = async () => {
    if (isLoading || joinLockRef.current) return;
    const cleanCode = extractTournamentCode(code);
    joinLockRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      if (onJoinTournament) {
        const result = await onJoinTournament(cleanCode);
        setShowConfirmModal(false);
        if (result?.id && onNavigate) {
          onNavigate(`/tournaments/${result.id}`);
          return;
        }
      }

      // REST join call (sending Bearer session token when authenticated)
      const token = socketClient.getAuthToken?.();
      const res = await fetch('/api/tournaments/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          code: cleanCode,
          playerId: currentUserId || 'player-join',
          playerName: currentUserName
        })
      });
      const data = await res.json();
      if (res.ok && data.success && data.tournament?.id) {
        setShowConfirmModal(false);
        if (onNavigate) {
          onNavigate(`/tournaments/${data.tournament.id}`);
        }
      } else if (data.alreadyJoined && data.tournament?.id) {
        setShowConfirmModal(false);
        if (onNavigate) {
          onNavigate(`/tournaments/${data.tournament.id}`);
        }
      } else {
        setError(data.error || 'Failed to join tournament. Code may be invalid or tournament is full.');
        setShowConfirmModal(false);
      }
    } catch (err) {
      setError(err.message || 'Error joining tournament');
      setShowConfirmModal(false);
    } finally {
      joinLockRef.current = false;
      setIsLoading(false);
    }
  };

  const formatRulesSummary = (format) => {
    switch (format) {
      case 'KNOCKOUT':
        return 'Win your match to advance. Single-elimination bracket with real-time 5x5 Bingo duels. One loss eliminates you.';
      case 'LEAGUE':
        return 'Play scheduled round-robin matches. Earn +3 points per victory. Top 4 ranked players qualify for championship playoffs.';
      case 'HYBRID':
        return 'Group stage round-robin followed by top 4 playoff semifinals and finals.';
      case 'TEAM_LEAGUE':
        return 'Franchise team battle. Cooperate with team members to earn points on the league table.';
      default:
        return 'Standard multiplayer competitive Bingo rules apply.';
    }
  };

  return (
    <PageShell
      title="Join Tournament"
      subtitle="Enter a tournament invite code to participate with friends"
      onBack={() => onNavigate && onNavigate('/tournaments')}
    >
      <div className="tourn-join-card">
        <form onSubmit={handleInitiateJoin} noValidate>
          {error && (
            <div className="tourn-form-error-banner" role="alert" style={{ marginBottom: '16px' }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="tournament-code" className="form-label" style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              Tournament Invite Code
            </label>
            <div className="code-input-container" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                id="tournament-code"
                type="text"
                className="form-input code-input"
                placeholder="Enter code or invite link"
                maxLength={120}
                value={code}
                onChange={(e) => setCode(extractTournamentCode(e.target.value))}
                autoFocus
                autoComplete="off"
                spellCheck="false"
                style={{ flex: '1 1 200px' }}
              />
              <button
                type="button"
                className="btn-tactile btn-secondary"
                onClick={() => setShowScannerModal(true)}
                style={{ minHeight: '46px', padding: '0 14px', whiteSpace: 'nowrap' }}
              >
                <span>📷</span>
                <span>Scan QR / Link</span>
              </button>
            </div>
            <span className="form-hint" style={{ color: 'var(--tourn-text-muted)', fontSize: '0.82rem', marginTop: '4px', display: 'block' }}>
              Enter your friend&apos;s tournament code, paste a joining link, or scan their lobby QR code.
            </span>
          </div>

          {/* Tournament Preview Card if found */}
          {previewTournament && (
            <div className="join-preview-card" style={{ background: 'var(--tourn-bg-card)', border: '1px solid var(--tourn-border-highlight)', borderRadius: '12px', padding: '16px', margin: '16px 0' }}>
              <div className="preview-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <span className={`tourn-format-badge format-${previewTournament.format?.toLowerCase()}`}>
                    {previewTournament.format}
                  </span>
                  <h4 className="preview-title" style={{ margin: '6px 0 0', fontSize: '1.1rem', color: 'var(--tourn-text-primary)' }}>
                    {previewTournament.name}
                  </h4>
                </div>
                <StatusBadge status={previewTournament.status} size="small" />
              </div>

              <div className="preview-host" style={{ fontSize: '0.85rem', color: 'var(--tourn-text-secondary)', marginBottom: '8px' }}>
                👑 Host: <strong style={{ color: 'var(--tourn-text-primary)' }}>{previewTournament.hostName || previewTournament.creatorName || 'Official'}</strong>
              </div>

              <div className="preview-meta" style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--tourn-text-secondary)', flexWrap: 'wrap' }}>
                <span>
                  👥 {previewTournament.participants?.length || 0} / {previewTournament.maxPlayers || 8} Players
                </span>
                <span>🪙 Prize: {previewTournament.prizePool || 1000} Coins</span>
                <span>{previewTournament.entryFee > 0 ? `🪙 Fee: ${previewTournament.entryFee}` : '🟢 Free Entry'}</span>
              </div>
            </div>
          )}

          <div className="form-actions" style={{ marginTop: '20px' }}>
            {isAlreadyJoined ? (
              <button
                type="button"
                className="btn-tactile btn-primary btn-submit-large"
                onClick={() => onNavigate && onNavigate(`/tournaments/${previewTournament.id}`)}
                style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 700 }}
              >
                <span>✅</span>
                <span>Already Joined — Open Tournament Lobby →</span>
              </button>
            ) : (
              <button
                type="submit"
                className="btn-tactile btn-amber btn-submit-large"
                disabled={isLoading || !code.trim()}
                style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 700 }}
              >
                {isLoading ? (
                  <span>Checking Code...</span>
                ) : (
                  <>
                    <span>🏆</span>
                    <span>Review &amp; Enter Tournament</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ==================== QR SCANNER & INVITE LINK MODAL ==================== */}
      {showScannerModal && (
        <div className="tourn-modal-backdrop" onClick={() => setShowScannerModal(false)}>
          <div
            className="tourn-modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-scanner-title"
            style={{ maxWidth: '460px', width: '92%' }}
          >
            <div className="tourn-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--tourn-border)', paddingBottom: '10px' }}>
              <h3 id="qr-scanner-title" style={{ margin: 0, fontSize: '1.1rem' }}>📷 Scan Tournament QR or Paste Link</h3>
              <button type="button" className="btn-tactile btn-secondary" onClick={() => setShowScannerModal(false)} style={{ padding: '4px 10px', minHeight: '34px' }}>✕</button>
            </div>
            <div style={{ margin: '14px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', maxHeight: '220px', borderRadius: '10px', background: '#070b14', objectFit: 'cover' }}
              />
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--tourn-text-secondary)', lineHeight: 1.4 }}>
                {scannerStatus || 'Preparing camera scanner...'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: 0 }}>Upload QR Image Screenshot</label>
                <input type="file" accept="image/*" onChange={handleQrImageUpload} className="form-input" style={{ padding: '8px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Paste full /tournaments/join/CODE link"
                  value={linkPasteInput}
                  onChange={(e) => setLinkPasteInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn-tactile btn-amber"
                  onClick={() => {
                    const parsed = extractTournamentCode(linkPasteInput);
                    if (parsed) {
                      setCode(parsed);
                      setShowScannerModal(false);
                    }
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CONFIRMATION MODAL ==================== */}
      {showConfirmModal && previewTournament && (
        <div className="tourn-modal-backdrop" onClick={() => !isLoading && setShowConfirmModal(false)}>
          <div
            className="tourn-modal-content tourn-join-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            style={{ maxWidth: '480px', width: '90%' }}
          >
            <div className="tourn-modal-header" style={{ borderBottom: '1px solid var(--tourn-border)', paddingBottom: '12px' }}>
              <h3 id="confirm-modal-title" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--tourn-text-primary)' }}>
                Confirm Tournament Entry
              </h3>
            </div>

            <div className="confirm-modal-body" style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '10px', padding: '12px', border: '1px solid var(--tourn-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`tourn-format-badge format-${previewTournament.format?.toLowerCase()}`}>
                    {previewTournament.format}
                  </span>
                  <StatusBadge status={previewTournament.status} size="small" />
                </div>
                <h4 style={{ margin: '8px 0 4px', fontSize: '1.15rem' }}>{previewTournament.name}</h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--tourn-text-secondary)' }}>
                  Host: <strong style={{ color: 'var(--tourn-text-primary)' }}>{previewTournament.hostName || previewTournament.creatorName || 'Official'}</strong>
                </div>
              </div>

              {/* Tournament Specs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                <div style={{ background: 'var(--tourn-bg-card)', padding: '8px 12px', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--tourn-text-muted)', display: 'block', fontSize: '0.75rem' }}>Capacity</span>
                  <strong>{previewTournament.participants?.length || 0} / {previewTournament.maxPlayers || 8} Slots</strong>
                </div>
                <div style={{ background: 'var(--tourn-bg-card)', padding: '8px 12px', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--tourn-text-muted)', display: 'block', fontSize: '0.75rem' }}>Prize Pool</span>
                  <strong style={{ color: '#fbbf24' }}>🪙 {previewTournament.prizePool || 1000} Coins</strong>
                </div>
                <div style={{ background: 'var(--tourn-bg-card)', padding: '8px 12px', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--tourn-text-muted)', display: 'block', fontSize: '0.75rem' }}>Entry Fee</span>
                  <strong style={{ color: previewTournament.entryFee > 0 ? '#fbbf24' : '#10b981' }}>
                    {previewTournament.entryFee > 0 ? `${previewTournament.entryFee} Coins` : 'Free Entry'}
                  </strong>
                </div>
                <div style={{ background: 'var(--tourn-bg-card)', padding: '8px 12px', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--tourn-text-muted)', display: 'block', fontSize: '0.75rem' }}>Code</span>
                  <strong style={{ letterSpacing: '1px' }}>{previewTournament.code}</strong>
                </div>
              </div>

              {/* Rules description */}
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '0.82rem', color: '#93c5fd', lineHeight: 1.4 }}>
                ℹ️ <strong>Format Rules:</strong> {formatRulesSummary(previewTournament.format)}
              </div>
            </div>

            <div className="confirm-modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--tourn-border)', paddingTop: '12px' }}>
              <button
                type="button"
                className="btn-tactile btn-secondary"
                disabled={isLoading}
                onClick={() => setShowConfirmModal(false)}
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-tactile btn-amber"
                disabled={isLoading}
                onClick={handleConfirmJoin}
                style={{ padding: '8px 20px', fontWeight: 700 }}
              >
                {isLoading ? 'Entering...' : '✅ Confirm & Join'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

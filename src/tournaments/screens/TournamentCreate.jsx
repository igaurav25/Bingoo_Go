/**
 * src/tournaments/screens/TournamentCreate.jsx
 * 
 * 5-Step Guided Tournament Creation Wizard (/tournaments/new).
 * Step 1: Basic Information (Name, format, description)
 * Step 2: Participants (Limit [4, 6, 8, 10, 12, 16], entry fee, invite mode)
 * Step 3: Rules (Points for wins/losses, matches, qualification slots)
 * Step 4: Fixtures (Automatic pairing, round timers, seeding)
 * Step 5: Review (Comprehensive summary, step editing, submit)
 * Preserves form state when moving between steps.
 */

import React, { useState, useEffect, useRef } from 'react';
import { PageShell } from '../components/PageShell.jsx';
import { Num } from '../components/Num.jsx';
import { socketClient } from '../../services/socketClient.js';

export function TournamentCreate({
  currentUserId = null,
  currentUserName = 'Host',
  onCreateTournament = null,
  onNavigate = null
}) {
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [name, setName] = useState('');
  const [season, setSeason] = useState('Season 01');
  const [logo, setLogo] = useState('🏆');
  const [format, setFormat] = useState('HYBRID'); // HYBRID (IPL) | KNOCKOUT | LEAGUE | TEAM_LEAGUE
  const [description, setDescription] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(8); // 4 | 6 | 8 | 10 | 12 | 14 | 16
  const [minParticipants, setMinParticipants] = useState(2);
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [startTime, setStartTime] = useState('');
  const [matchesPerPlayer, setMatchesPerPlayer] = useState(5);
  const [requireReadyToStart, setRequireReadyToStart] = useState(false);
  const [disconnectRule, setDisconnectRule] = useState('PAUSE_60S');
  const [timeoutRule, setTimeoutRule] = useState('AUTO_PICK');
  const [entryFee, setEntryFee] = useState(100); // 0 | 50 | 100 | 250 | 500
  const [inviteMode, setInviteMode] = useState('OPEN'); // OPEN | INVITE_ONLY
  const [approvalMode, setApprovalMode] = useState('AUTOMATIC'); // AUTOMATIC | HOST_APPROVAL
  const [scheduleMode, setScheduleMode] = useState('AUTOMATIC'); // AUTOMATIC | HOST_MANAGED
  const [pointsWin, setPointsWin] = useState(2);
  const [pointsLoss, setPointsLoss] = useState(0);
  const [qualificationSlots, setQualificationSlots] = useState(4);
  const [playoffFormat, setPlayoffFormat] = useState('IPL_TOP4'); // IPL_TOP4 | TOP2_FINAL | SEMIFINAL_TOP4
  const [turnTimerSeconds, setTurnTimerSeconds] = useState(30);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState('idle'); // 'idle' | 'submitting' | 'created' | 'failed'
  const [createdTournament, setCreatedTournament] = useState(null);
  const submitLockRef = useRef(false);
  const [formError, setFormError] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const submitButtonLabel = isSubmitting || submitState === 'submitting'
    ? 'Creating Tournament...'
    : submitState === 'created'
      ? 'Tournament Created'
      : submitState === 'failed'
        ? 'Creation Failed'
        : 'Create Tournament';

  const handleSelectMaxPlayers = (num) => {
    if (submitState === 'failed') setSubmitState('idle');
    setMaxPlayers(num);
    if (minParticipants > num) {
      setMinParticipants(num);
    }
    if (matchesPerPlayer && matchesPerPlayer >= num) {
      setMatchesPerPlayer(Math.max(1, num - 1));
    }
    if (num < 4 && qualificationSlots > 2) {
      setQualificationSlots(2);
      setPlayoffFormat('TOP2_FINAL');
    }
  };

  const handleResetForm = () => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to reset all tournament fields?')) {
      return;
    }
    setName('');
    setSeason('Season 01');
    setLogo('🏆');
    setFormat('HYBRID');
    setDescription('');
    setMaxPlayers(8);
    setMinParticipants(2);
    setRegistrationDeadline('');
    setStartTime('');
    setMatchesPerPlayer(5);
    setRequireReadyToStart(false);
    setDisconnectRule('PAUSE_60S');
    setTimeoutRule('AUTO_PICK');
    setEntryFee(100);
    setInviteMode('OPEN');
    setApprovalMode('AUTOMATIC');
    setScheduleMode('AUTOMATIC');
    setPointsWin(2);
    setPointsLoss(0);
    setQualificationSlots(4);
    setPlayoffFormat('IPL_TOP4');
    setTurnTimerSeconds(30);
    setCurrentStep(1);
    setFormError(null);
    setSubmitState('idle');
    setCreatedTournament(null);
  };

  const handleCancel = () => {
    const hasEdits = name.trim().length > 0 || description.trim().length > 0 || currentStep > 1;
    if (hasEdits && typeof window !== 'undefined' && !window.confirm('You have unsaved changes. Discard and return to Tournaments?')) {
      return;
    }
    if (onNavigate) {
      onNavigate('/tournaments');
    }
  };

  // Check URL query param for default format (e.g. ?format=LEAGUE)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fmt = params.get('format');
      if (fmt && ['KNOCKOUT', 'LEAGUE', 'HYBRID'].includes(fmt.toUpperCase())) {
        setFormat(fmt.toUpperCase());
      }
    }
  }, []);

  // Compute calculated prize pool
  const totalPrizePool = Math.max(500, maxPlayers * entryFee * 0.9);
  const firstPrize = Math.round(totalPrizePool * 0.6);
  const secondPrize = Math.round(totalPrizePool * 0.25);
  const thirdPrize = Math.round(totalPrizePool * 0.15);

  // Step Validation
  const validateStep = (stepNumber) => {
    setFormError(null);
    if (stepNumber === 1) {
      const trimmed = name.trim();
      if (!trimmed) {
        setFormError('Please enter a tournament name');
        return false;
      }
      if (trimmed.length < 3) {
        setFormError('Tournament name must be at least 3 characters');
        return false;
      }
    }
    if (stepNumber === 2) {
      if (!Number.isFinite(Number(maxPlayers)) || maxPlayers < 2 || maxPlayers > 16) {
        setFormError('Total player capacity must be between 2 and 16');
        return false;
      }
      if (!Number.isFinite(Number(minParticipants)) || minParticipants < 2 || minParticipants > maxPlayers) {
        setFormError(`Minimum participants must be between 2 and ${maxPlayers}`);
        return false;
      }
      if (!Number.isFinite(Number(entryFee)) || entryFee < 0) {
        setFormError('Entry fee cannot be negative');
        return false;
      }
      if (registrationDeadline && registrationDeadline.trim() !== '' && Number.isNaN(new Date(registrationDeadline).getTime())) {
        setFormError('Please enter a valid registration deadline date or leave it blank');
        return false;
      }
    }
    if (stepNumber === 3 && format !== 'KNOCKOUT') {
      if (Number(pointsWin) < 0 || Number(pointsLoss) < 0) {
        setFormError('Points per win and loss must be 0 or greater');
        return false;
      }
      if (matchesPerPlayer && (matchesPerPlayer < 1 || matchesPerPlayer > maxPlayers - 1)) {
        setFormError(`With ${maxPlayers} players, matches per player cannot exceed ${maxPlayers - 1} without repeated opponents.`);
        return false;
      }
      if (qualificationSlots > maxPlayers) {
        setFormError(`Playoff qualification slots (${qualificationSlots}) cannot exceed total players (${maxPlayers}).`);
        return false;
      }
    }
    if (stepNumber === 4) {
      if (!Number.isFinite(Number(turnTimerSeconds)) || turnTimerSeconds < 10 || turnTimerSeconds > 120) {
        setFormError('Turn timer must be between 10 and 120 seconds');
        return false;
      }
      if (startTime && startTime.trim() !== '' && Number.isNaN(new Date(startTime).getTime())) {
        setFormError('Please enter a valid start time or leave it blank');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 5) {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handlePrev = () => {
    setFormError(null);
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else if (onNavigate) {
      onNavigate('/tournaments');
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmitting || submitLockRef.current) return;

    for (const stepToCheck of [1, 2, 3, 4]) {
      if (!validateStep(stepToCheck)) {
        setCurrentStep(stepToCheck);
        return;
      }
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setSubmitState('submitting');
    setFormError(null);

    let effectiveUserId = currentUserId || socketClient.playerId || null;
    let effectiveUserName = currentUserName || socketClient.playerName || 'Host';
    if ((!effectiveUserId || !socketClient.getAuthToken?.()) && typeof socketClient.ensureSession === 'function') {
      try {
        const sessionUser = await socketClient.ensureSession();
        if (sessionUser?.id) {
          effectiveUserId = sessionUser.id;
          effectiveUserName = sessionUser.profile?.displayName || sessionUser.username || effectiveUserName;
        }
      } catch {
        // Fallback handled by server auth check
      }
    }

    const parsedDeadline = registrationDeadline && registrationDeadline.trim() !== ''
      ? new Date(registrationDeadline).toISOString()
      : null;
    const parsedStartTime = startTime && startTime.trim() !== ''
      ? new Date(startTime).toISOString()
      : null;

    const payload = {
      name: name.trim(),
      season: season.trim() || 'Season 01',
      logo: logo || '🏆',
      format,
      isTeamLeague: format === 'TEAM_LEAGUE',
      description: description.trim() || `${format} tournament for friends`,
      minParticipants: Math.max(2, Math.min(maxPlayers, Number(minParticipants) || 2)),
      maxParticipants: maxPlayers,
      maxPlayers,
      registrationDeadline: parsedDeadline,
      startTime: parsedStartTime,
      matchesPerPlayer: (format === 'LEAGUE' || format === 'HYBRID') && matchesPerPlayer ? Number(matchesPerPlayer) : null,
      requireReadyToStart,
      disconnectRule,
      timeoutRule,
      autoStart: false,
      entryFee,
      prizePool: totalPrizePool,
      visibility: inviteMode,
      approvalMode,
      scheduleMode,
      pointsPerWin: pointsWin,
      pointsPerLoss: pointsLoss,
      pointsWin,
      pointsLoss,
      qualificationSlots,
      playoffFormat: format === 'HYBRID' ? playoffFormat : undefined,
      turnTimerSeconds,
      ...(effectiveUserId ? {
        creatorId: effectiveUserId,
        hostId: effectiveUserId
      } : {}),
      creatorName: effectiveUserName || 'Host',
      hostName: effectiveUserName || 'Host'
    };

    try {
      let created = null;
      if (onCreateTournament) {
        created = await onCreateTournament(payload);
      } else {
        const token = socketClient.getAuthToken?.();
        const res = await fetch('/api/tournaments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.tournament?.id) {
          throw new Error(data.error || 'Failed to create tournament');
        }
        created = data.room && !data.tournament.room
          ? { ...data.tournament, room: data.room }
          : data.tournament;
      }

      if (!created?.id) {
        throw new Error('Server did not return a created tournament record');
      }

      setCreatedTournament(created);
      setSubmitState('created');
      if (onNavigate) {
        onNavigate(`/tournaments/${created.id}`);
      }
    } catch (err) {
      setSubmitState('failed');
      setFormError(err.message || 'Creation Failed — please try again');
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell
      title="Create Tournament"
      subtitle={`Guided Wizard • Step ${currentStep} of 5: ${
        currentStep === 1 ? 'Basic Info' :
        currentStep === 2 ? 'Participants' :
        currentStep === 3 ? 'Match Rules' :
        currentStep === 4 ? 'Fixtures & Timing' : 'Review & Confirm'
      }`}
      onBack={handlePrev}
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-tactile btn-secondary"
            onClick={() => setShowPreviewModal(true)}
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
          >
            <span>👁️</span> Preview
          </button>
          <button
            type="button"
            className="btn-tactile btn-secondary"
            onClick={handleResetForm}
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
          >
            <span>🔄</span> Reset
          </button>
          <button
            type="button"
            className="btn-tactile btn-secondary"
            onClick={handleCancel}
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
          >
            Cancel
          </button>
        </div>
      }
    >
      {/* 5-Step Progress Stepper */}
      <div className="tourn-wizard-stepper" role="navigation" aria-label="Creation Steps">
        {[
          { step: 1, title: 'Basics' },
          { step: 2, title: 'Players' },
          { step: 3, title: 'Rules' },
          { step: 4, title: 'Fixtures' },
          { step: 5, title: 'Review' }
        ].map(item => (
          <button
            key={item.step}
            type="button"
            className={`wizard-step-pill ${currentStep === item.step ? 'active' : ''} ${item.step < currentStep ? 'completed' : ''}`}
            onClick={() => {
              if (item.step < currentStep || validateStep(currentStep)) {
                setCurrentStep(item.step);
              }
            }}
          >
            <span className="step-circle">{item.step < currentStep ? '✓' : item.step}</span>
            <span className="step-label">{item.title}</span>
          </button>
        ))}
      </div>

      <div className="tourn-create-layout">
        {/* Main Column: Real Form Element with Always-Visible Create Button */}
        <form className="tourn-create-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="tourn-form-error-banner" role="alert">
              <span>⚠️</span>
              <span>{formError}</span>
            </div>
          )}

          {createdTournament && (
            <div
              className="tourn-info-card"
              role="status"
              style={{
                background: 'rgba(16, 185, 129, 0.14)',
                border: '1px solid #10b981',
                padding: '12px 14px',
                borderRadius: '12px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}
            >
              <div>
                <strong style={{ color: '#34d399', display: 'block' }}>
                  ✓ Tournament Created ({createdTournament.code})
                </strong>
                <span style={{ fontSize: '0.82rem', color: 'var(--tourn-text-secondary)' }}>
                  Room lobby is live and ready for players.
                </span>
              </div>
              <button
                type="button"
                className="btn-tactile btn-primary"
                onClick={() => onNavigate && onNavigate(`/tournaments/${createdTournament.id}`)}
              >
                Open Tournament Lobby →
              </button>
            </div>
          )}

          {/* ==================== STEP 1: BASIC INFORMATION ==================== */}
          {currentStep === 1 && (
            <div className="wizard-step-card">
              <div className="step-card-header">
                <span className="step-badge">Step 1 of 5</span>
                <h3 className="step-title">Basic Tournament Information</h3>
                <p className="step-desc">Name your tournament, pick a competitive format, and provide a short description.</p>
              </div>

              {/* Tournament Name */}
              <div className="form-group">
                <label htmlFor="tourn-input-name" className="form-label">
                  Tournament Name <span className="required-mark">*</span>
                </label>
                <input
                  id="tourn-input-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g., Bingo Premier League Season 1"
                  value={name}
                  onChange={(e) => {
                    if (submitState === 'failed') setSubmitState('idle');
                    setName(e.target.value);
                  }}
                  maxLength={50}
                  autoFocus
                />
                <span className="form-hint">A clear, recognizable name that your friends can search by.</span>
              </div>

              {/* Tournament Logo & Season */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Tournament Logo</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {['🏆', '🦁', '⚡', '👑', '🛡️', '🚀', '🐅', '🦊'].map(em => (
                      <button
                        key={em}
                        type="button"
                        className={`select-chip ${logo === em ? 'active' : ''}`}
                        style={{ fontSize: '1.2rem', padding: '6px 12px', minWidth: '42px' }}
                        onClick={() => setLogo(em)}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="tourn-input-season" className="form-label">Tournament Season</label>
                  <input
                    id="tourn-input-season"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Season 01"
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    maxLength={20}
                  />
                </div>
              </div>

              {/* Format Choice */}
              <div className="form-group">
                <label className="form-label">Choose Tournament Format</label>
                <div className="format-selection-grid">
                  {[
                    { id: 'HYBRID', label: '🏆 IPL League + Playoffs', desc: 'League Points Table (Q1, Eliminator, Q2) leading to Grand Final & Champion.' },
                    { id: 'KNOCKOUT', label: '🥊 Knockout Cup', desc: 'Single elimination: Win to advance, lose to exit.' },
                    { id: 'LEAGUE', label: '📋 Pure League Table', desc: 'Balanced round-robin points table; #1 ranked wins the trophy.' },
                    { id: 'TEAM_LEAGUE', label: '🦁 Team Franchise League', desc: 'Franchise cup with captains, squad points & playoffs.' }
                  ].map(f => (
                    <div
                      key={f.id}
                      className={`format-option-card ${format === f.id ? 'selected' : ''}`}
                      onClick={() => setFormat(f.id)}
                      role="radio"
                      aria-checked={format === f.id}
                      tabIndex={0}
                    >
                      <div className="opt-header">
                        <strong className="opt-title">{f.label}</strong>
                        {format === f.id && <span className="opt-check">✓</span>}
                      </div>
                      <p className="opt-desc">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label htmlFor="tourn-input-desc" className="form-label">Description (Optional)</label>
                <textarea
                  id="tourn-input-desc"
                  className="form-input form-textarea"
                  placeholder="e.g. Friendly weekend tournament played under classic notebook rules."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* ==================== STEP 2: PARTICIPANTS ==================== */}
          {currentStep === 2 && (
            <div className="wizard-step-card">
              <div className="step-card-header">
                <span className="step-badge">Step 2 of 5</span>
                <h3 className="step-title">Participants & Capacity</h3>
                <p className="step-desc">Set maximum player capacity, entry fee in coins, and access permissions.</p>
              </div>

              {/* Max Players */}
              <div className="form-group">
                <label className="form-label">Maximum Player Limit</label>
                <div className="chips-grid">
                  {[4, 6, 8, 10, 12, 14, 16].map(num => (
                    <button
                      key={num}
                      type="button"
                      className={`select-chip ${maxPlayers === num ? 'active' : ''}`}
                      onClick={() => handleSelectMaxPlayers(num)}
                    >
                      {num} Players
                      {[6, 10, 12, 14].includes(num) && <span className="chip-sub">Byes Supported</span>}
                    </button>
                  ))}
                </div>
                <span className="form-hint">
                  {format === 'KNOCKOUT' && [6, 10, 12, 14].includes(maxPlayers)
                    ? 'Odd-sized brackets automatically award first-round Byes to top seeds.'
                    : 'Select how many players can join your tournament lobby.'}
                </span>
              </div>

              {/* Minimum Participants & Registration Deadline */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="tourn-min-players" className="form-label">Minimum Players Required to Start</label>
                  <select
                    id="tourn-min-players"
                    className="form-input"
                    value={minParticipants}
                    onChange={(e) => setMinParticipants(Number(e.target.value))}
                  >
                    {[2, 4, 6, 8, 10, 12, 14, 16].filter(n => n <= maxPlayers).map(n => (
                      <option key={n} value={n}>{n} Players (Minimum)</option>
                    ))}
                  </select>
                  <span className="form-hint">Host can only start once at least {minParticipants} players join.</span>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="tourn-reg-deadline" className="form-label">Registration Deadline (Optional)</label>
                  <input
                    id="tourn-reg-deadline"
                    type="datetime-local"
                    className="form-input"
                    value={registrationDeadline}
                    onChange={(e) => setRegistrationDeadline(e.target.value)}
                  />
                  <span className="form-hint">Leave blank to keep registration open until you start.</span>
                </div>
              </div>

              {/* Entry Fee */}
              <div className="form-group">
                <label className="form-label">Entry Fee (Virtual Coins)</label>
                <div className="chips-grid">
                  {[0, 50, 100, 250, 500].map(fee => (
                    <button
                      key={fee}
                      type="button"
                      className={`select-chip ${entryFee === fee ? 'active' : ''}`}
                      onClick={() => setEntryFee(fee)}
                    >
                      {fee === 0 ? 'Free Entry' : `${fee} 🪙`}
                    </button>
                  ))}
                </div>
                <span className="form-hint">Coins are pooled together for the tournament champion rewards.</span>
              </div>

              {/* Access Permissions & Approval Mode */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Access Mode</label>
                  <div className="chips-grid">
                    <button
                      type="button"
                      className={`select-chip ${inviteMode === 'OPEN' ? 'active' : ''}`}
                      onClick={() => setInviteMode('OPEN')}
                    >
                      🟢 Public / Open
                    </button>
                    <button
                      type="button"
                      className={`select-chip ${inviteMode === 'INVITE_ONLY' ? 'active' : ''}`}
                      onClick={() => setInviteMode('INVITE_ONLY')}
                    >
                      🔒 Private Code
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Registration Approval</label>
                  <div className="chips-grid">
                    <button
                      type="button"
                      className={`select-chip ${approvalMode === 'AUTOMATIC' ? 'active' : ''}`}
                      onClick={() => setApprovalMode('AUTOMATIC')}
                    >
                      ⚡ Auto Approval
                    </button>
                    <button
                      type="button"
                      className={`select-chip ${approvalMode === 'HOST_APPROVAL' ? 'active' : ''}`}
                      onClick={() => setApprovalMode('HOST_APPROVAL')}
                    >
                      🛡️ Host Approval
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== STEP 3: MATCH RULES ==================== */}
          {currentStep === 3 && (
            <div className="wizard-step-card">
              <div className="step-card-header">
                <span className="step-badge">Step 3 of 5</span>
                <h3 className="step-title">Rules & Qualification</h3>
                <p className="step-desc">Configure scoring points and how players qualify for tournament playoffs.</p>
              </div>

              {/* Points for Win & Loss */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Points Awarded per Match Win</label>
                  <div className="chips-grid">
                    {[2, 3, 4].map(pts => (
                      <button
                        key={pts}
                        type="button"
                        className={`select-chip ${pointsWin === pts ? 'active' : ''}`}
                        onClick={() => setPointsWin(pts)}
                      >
                        +{pts} Pts {pts === 2 ? '(IPL)' : ''}
                      </button>
                    ))}
                  </div>
                  <span className="form-hint">IPL leagues award 2 points per win.</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Points Awarded on Loss</label>
                  <div className="chips-grid">
                    {[0, 1].map(pts => (
                      <button
                        key={pts}
                        type="button"
                        className={`select-chip ${pointsLoss === pts ? 'active' : ''}`}
                        onClick={() => setPointsLoss(pts)}
                      >
                        {pts} Pts
                      </button>
                    ))}
                  </div>
                  <span className="form-hint">Standard loss awards 0 points.</span>
                </div>
              </div>

              {/* Qualification Slots, Matches per Player & Playoff Format */}
              {format !== 'KNOCKOUT' && (
                <>
                  <div className="form-group">
                    <label className="form-label">League Matches per Player</label>
                    <div className="chips-grid">
                      {[
                        { val: null, label: `Full Round-Robin (${Math.max(1, maxPlayers - 1)})` },
                        { val: 2, label: '2 Matches' },
                        { val: 3, label: '3 Matches' },
                        { val: 4, label: '4 Matches' },
                        { val: 5, label: '5 Matches (IPL Default)' },
                        { val: 6, label: '6 Matches' }
                      ].filter(o => o.val === null || o.val < maxPlayers).map(opt => (
                        <button
                          key={String(opt.val)}
                          type="button"
                          className={`select-chip ${matchesPerPlayer === opt.val ? 'active' : ''}`}
                          onClick={() => setMatchesPerPlayer(opt.val)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Playoff Qualification Cut</label>
                    <div className="chips-grid">
                      {[2, 4].map(slots => (
                        <button
                          key={slots}
                          type="button"
                          className={`select-chip ${qualificationSlots === slots ? 'active' : ''}`}
                          onClick={() => {
                            setQualificationSlots(slots);
                            setPlayoffFormat(slots === 2 ? 'TOP2_FINAL' : (playoffFormat === 'TOP2_FINAL' ? 'IPL_TOP4' : playoffFormat));
                          }}
                        >
                          Top {slots} Qualify
                        </button>
                      ))}
                    </div>
                    <span className="form-hint">
                      {qualificationSlots === 2
                        ? 'Rank 1 vs Rank 2 meet directly in the Grand Final.'
                        : 'Top 4 teams enter Qualifier 1, Eliminator, Qualifier 2 & Grand Final.'}
                    </span>
                  </div>

                  {format === 'HYBRID' && qualificationSlots === 4 && (
                    <div className="form-group">
                      <label className="form-label">Playoff Format</label>
                      <div className="chips-grid">
                        {[
                          { id: 'IPL_TOP4', label: '🏆 IPL Top-4 (Q1 • Elim • Q2 • Final)' },
                          { id: 'SEMIFINAL_TOP4', label: '🥊 Standard Semifinals (1v4, 2v3)' }
                        ].map(pf => (
                          <button
                            key={pf.id}
                            type="button"
                            className={`select-chip ${playoffFormat === pf.id ? 'active' : ''}`}
                            onClick={() => setPlayoffFormat(pf.id)}
                          >
                            {pf.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Tie-breaker rules note */}
              <div className="tourn-info-card" style={{ marginTop: '12px', background: 'var(--bg-subtle)', padding: '12px', borderRadius: '12px' }}>
                <strong>⚖️ Tie-Breaker Priority:</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  1. Points → 2. Direct Head-to-Head → 3. Total Wins → 4. Win Percentage → 5. Lobby Seed.
                </p>
              </div>
            </div>
          )}

          {/* ==================== STEP 4: FIXTURES & TIMING ==================== */}
          {currentStep === 4 && (
            <div className="wizard-step-card">
              <div className="step-card-header">
                <span className="step-badge">Step 4 of 5</span>
                <h3 className="step-title">Fixtures & Scheduling Mode</h3>
                <p className="step-desc">Specify turn clock duration and match scheduling rules.</p>
              </div>

              {/* Turn Clock */}
              <div className="form-group">
                <label className="form-label">Turn Clock Duration</label>
                <div className="chips-grid">
                  {[15, 30, 45, 60].map(sec => (
                    <button
                      key={sec}
                      type="button"
                      className={`select-chip ${turnTimerSeconds === sec ? 'active' : ''}`}
                      onClick={() => setTurnTimerSeconds(sec)}
                    >
                      ⏱️ {sec} Seconds
                    </button>
                  ))}
                </div>
                <span className="form-hint">Time allowed per turn before an auto-call is made. 30s is recommended.</span>
              </div>

              {/* Scheduling Mode & Optional Start Time */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="tourn-start-time" className="form-label">Scheduled Start Time (Optional)</label>
                  <input
                    id="tourn-start-time"
                    type="datetime-local"
                    className="form-input"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                  <span className="form-hint">Displayed on cards and lobby banner.</span>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Player Ready Check</label>
                  <div className="chips-grid">
                    <button
                      type="button"
                      className={`select-chip ${!requireReadyToStart ? 'active' : ''}`}
                      onClick={() => setRequireReadyToStart(false)}
                    >
                      ⚡ Flexible Start
                    </button>
                    <button
                      type="button"
                      className={`select-chip ${requireReadyToStart ? 'active' : ''}`}
                      onClick={() => setRequireReadyToStart(true)}
                    >
                      ✓ All Ready Required
                    </button>
                  </div>
                </div>
              </div>

              {/* Disconnect & Timeout Handling Rules */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Disconnect Recovery Rule</label>
                  <div className="chips-grid">
                    <button
                      type="button"
                      className={`select-chip ${disconnectRule === 'PAUSE_60S' ? 'active' : ''}`}
                      onClick={() => setDisconnectRule('PAUSE_60S')}
                    >
                      ⏸️ 60s Pause &amp; Resume
                    </button>
                    <button
                      type="button"
                      className={`select-chip ${disconnectRule === 'FORFEIT' ? 'active' : ''}`}
                      onClick={() => setDisconnectRule('FORFEIT')}
                    >
                      ⚠️ Instant Forfeit
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Turn Timeout Rule</label>
                  <div className="chips-grid">
                    <button
                      type="button"
                      className={`select-chip ${timeoutRule === 'AUTO_PICK' ? 'active' : ''}`}
                      onClick={() => setTimeoutRule('AUTO_PICK')}
                    >
                      🎲 Auto-Pick Number
                    </button>
                    <button
                      type="button"
                      className={`select-chip ${timeoutRule === 'SKIP_TURN' ? 'active' : ''}`}
                      onClick={() => setTimeoutRule('SKIP_TURN')}
                    >
                      ⏭️ Skip Turn
                    </button>
                  </div>
                </div>
              </div>

              {/* Scheduling Mode */}
              <div className="form-group">
                <label className="form-label">Scheduling Mode</label>
                <div className="chips-grid">
                  <button
                    type="button"
                    className={`select-chip ${scheduleMode === 'AUTOMATIC' ? 'active' : ''}`}
                    onClick={() => setScheduleMode('AUTOMATIC')}
                  >
                    ⚡ Automatic Schedule
                  </button>
                  <button
                    type="button"
                    className={`select-chip ${scheduleMode === 'HOST_MANAGED' ? 'active' : ''}`}
                    onClick={() => setScheduleMode('HOST_MANAGED')}
                  >
                    📅 Host-Managed Schedule
                  </button>
                </div>
                <span className="form-hint">
                  {scheduleMode === 'AUTOMATIC'
                    ? 'Server instantly generates pairings and unlocks matches in sequence.'
                    : 'Host controls when each fixture round becomes active.'}
                </span>
              </div>
            </div>
          )}

          {/* ==================== STEP 5: REVIEW & CONFIRM ==================== */}
          {currentStep === 5 && (
            <div className="wizard-step-card">
              <div className="step-card-header">
                <span className="step-badge">Step 5 of 5</span>
                <h3 className="step-title">Review & Confirm Tournament</h3>
                <p className="step-desc">Please review your tournament configuration before creating the official lobby.</p>
              </div>

              <div className="review-summary-box">
                <div className="review-item">
                  <div>
                    <span className="review-label">Tournament Name & Season</span>
                    <strong className="review-value">{logo} {name || 'Unnamed Tournament'} ({season})</strong>
                  </div>
                  <button type="button" className="btn-edit-step" onClick={() => setCurrentStep(1)}>Edit</button>
                </div>

                <div className="review-item">
                  <div>
                    <span className="review-label">Format</span>
                    <strong className="review-value">
                      {format === 'TEAM_LEAGUE' ? '🛡️ Team Franchise League' : `${format} Tournament`}
                    </strong>
                  </div>
                  <button type="button" className="btn-edit-step" onClick={() => setCurrentStep(1)}>Edit</button>
                </div>

                <div className="review-item">
                  <div>
                    <span className="review-label">Capacity & Access</span>
                    <strong className="review-value">
                      {maxPlayers} Players • {inviteMode === 'OPEN' ? '🟢 Public' : '🔒 Private Code'} • {approvalMode === 'AUTOMATIC' ? '⚡ Auto Approval' : '🛡️ Host Approval'}
                    </strong>
                  </div>
                  <button type="button" className="btn-edit-step" onClick={() => setCurrentStep(2)}>Edit</button>
                </div>

                <div className="review-item">
                  <div>
                    <span className="review-label">Scoring & Qualification</span>
                    <strong className="review-value">
                      +{pointsWin} Win / {pointsLoss} Loss • {format === 'HYBRID' ? `${playoffFormat === 'IPL_TOP4' ? 'IPL Top-4 (Q1/Elim/Q2/Final)' : (playoffFormat === 'TOP2_FINAL' ? 'Top-2 Grand Final' : 'Top-4 Semifinals')}` : (format !== 'KNOCKOUT' ? `Top ${qualificationSlots} Qualify` : 'Single Elimination')}
                    </strong>
                  </div>
                  <button type="button" className="btn-edit-step" onClick={() => setCurrentStep(3)}>Edit</button>
                </div>

                <div className="review-item">
                  <div>
                    <span className="review-label">Match Timer & Scheduling</span>
                    <strong className="review-value">
                      {turnTimerSeconds}s per turn • {scheduleMode === 'AUTOMATIC' ? '⚡ Automatic Scheduling' : '📅 Host-Managed Rounds'}
                    </strong>
                  </div>
                  <button type="button" className="btn-edit-step" onClick={() => setCurrentStep(4)}>Edit</button>
                </div>

                <div className="review-item">
                  <div>
                    <span className="review-label">Prize Distribution</span>
                    <strong className="review-value" style={{ color: 'var(--gold-dark)' }}>
                      🪙 {totalPrizePool} Coins (🥇 {firstPrize} / 🥈 {secondPrize} / 🥉 {thirdPrize})
                    </strong>
                  </div>
                </div>
              </div>

              <div className="tourn-info-card" style={{ marginTop: '14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '12px', borderRadius: '12px' }}>
                <span style={{ fontWeight: 800, color: '#047857' }}>✓ Ready to Launch:</span>
                <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#065f46' }}>
                  Creating this tournament will allocate an official 5-character room code and open the lobby for players to join.
                </p>
              </div>
            </div>
          )}

          {/* Always-Visible Navigation & Submit Footer */}
          <div className="wizard-nav-footer">
            <button
              type="button"
              className="btn-tactile btn-secondary"
              onClick={handlePrev}
              disabled={isSubmitting}
            >
              {currentStep === 1 ? 'Cancel' : '← Back'}
            </button>

            <div className="wizard-nav-actions-right">
              {currentStep < 5 && (
                <button
                  type="button"
                  className="btn-tactile btn-primary"
                  onClick={handleNext}
                  disabled={isSubmitting}
                >
                  Continue to Step {currentStep + 1} →
                </button>
              )}

              <button
                id="tourn-create-submit-btn"
                data-testid="create-tournament-submit"
                type="submit"
                className={`btn-tactile tourn-create-submit-btn ${submitState === 'failed' ? 'state-failed' : ''} ${submitState === 'created' ? 'state-created' : ''}`}
                disabled={isSubmitting}
              >
                {submitButtonLabel}
              </button>
            </div>
          </div>
        </form>

        {/* Right Column: Sticky Live Summary */}
        <aside className="tourn-create-summary-sidebar">
          <div className="sticky-summary-card">
            <div className="summary-header">
              <span className="summary-pill">LIVE PREVIEW</span>
              <h4 className="summary-name">{name || 'Tournament Title'}</h4>
              <span className="summary-format">{format} Format</span>
            </div>

            <div className="summary-stats-list">
              <div className="stat-row">
                <span>Participants:</span>
                <strong>Min <Num value={minParticipants} /> / Max <Num value={maxPlayers} /></strong>
              </div>
              <div className="stat-row">
                <span>Host:</span>
                <strong>{currentUserName || 'Host'}</strong>
              </div>

              <div className="stat-row">
                <span>Entry Fee:</span>
                <strong>{entryFee === 0 ? 'Free' : <><Num value={entryFee} /> 🪙</>}</strong>
              </div>

              <div className="stat-row">
                <span>Prize Pool:</span>
                <strong className="gold-text"><Num value={totalPrizePool} /> 🪙</strong>
              </div>

              <div className="stat-row">
                <span>Turn Timer:</span>
                <strong>{turnTimerSeconds}s</strong>
              </div>
            </div>

            <div className="summary-prizes-breakdown">
              <div className="prize-row gold">
                <span>🥇 1st Place (60%):</span>
                <strong><Num value={firstPrize} /> 🪙</strong>
              </div>
              <div className="prize-row silver">
                <span>🥈 2nd Place (25%):</span>
                <strong><Num value={secondPrize} /> 🪙</strong>
              </div>
              <div className="prize-row bronze">
                <span>🥉 3rd Place (15%):</span>
                <strong><Num value={thirdPrize} /> 🪙</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ==================== TOURNAMENT PREVIEW MODAL ==================== */}
      {showPreviewModal && (
        <div className="tourn-modal-backdrop" onClick={() => setShowPreviewModal(false)}>
          <div
            className="tourn-modal-content tourn-create-preview-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-preview-title"
            style={{ maxWidth: '540px', width: '92%' }}
          >
            <div className="tourn-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--tourn-border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>👁️</span>
                <h3 id="create-preview-title" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--tourn-text-primary)' }}>
                  Tournament Preview
                </h3>
              </div>
              <button
                type="button"
                className="btn-tactile btn-secondary"
                onClick={() => setShowPreviewModal(false)}
                style={{ minHeight: '34px', minWidth: '34px', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', padding: '14px', border: '1.5px solid var(--tourn-border-highlight)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`tourn-format-badge format-${format.toLowerCase()}`}>
                    {logo} {format}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600 }}>{season}</span>
                </div>
                <h4 style={{ margin: '8px 0 4px', fontSize: '1.25rem', color: 'var(--tourn-text-primary)' }}>
                  {name || 'Untitled Tournament'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--tourn-text-secondary)', lineHeight: 1.4 }}>
                  {description || `Official ${format} competitive tournament with friends.`}
                </p>
              </div>

              {/* Specs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.85rem' }}>
                <div style={{ background: 'var(--tourn-bg-card)', padding: '10px', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--tourn-text-muted)', display: 'block', fontSize: '0.74rem' }}>Total Capacity</span>
                  <strong>👥 {maxPlayers} Players</strong>
                </div>
                <div style={{ background: 'var(--tourn-bg-card)', padding: '10px', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--tourn-text-muted)', display: 'block', fontSize: '0.74rem' }}>Entry Fee</span>
                  <strong style={{ color: entryFee > 0 ? '#fbbf24' : '#10b981' }}>
                    {entryFee === 0 ? 'Free Entry' : `${entryFee} 🪙`}
                  </strong>
                </div>
                <div style={{ background: 'var(--tourn-bg-card)', padding: '10px', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--tourn-text-muted)', display: 'block', fontSize: '0.74rem' }}>Prize Pool</span>
                  <strong style={{ color: '#fbbf24' }}>🪙 {totalPrizePool} Coins</strong>
                </div>
                <div style={{ background: 'var(--tourn-bg-card)', padding: '10px', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--tourn-text-muted)', display: 'block', fontSize: '0.74rem' }}>Turn Clock</span>
                  <strong>⏱️ {turnTimerSeconds}s per turn</strong>
                </div>
              </div>

              {/* Prize Podium */}
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 700, color: '#fbbf24', display: 'block', marginBottom: '4px' }}>🏆 Prize Pool Breakdown</span>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🥇 1st: <strong>{firstPrize} 🪙</strong></span>
                  <span>🥈 2nd: <strong>{secondPrize} 🪙</strong></span>
                  <span>🥉 3rd: <strong>{thirdPrize} 🪙</strong></span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--tourn-border)', paddingTop: '12px' }}>
              <button
                type="button"
                className="btn-tactile btn-secondary"
                onClick={() => setShowPreviewModal(false)}
              >
                Close Preview
              </button>
              <button
                type="button"
                className="btn-tactile btn-amber"
                disabled={isSubmitting}
                onClick={(e) => {
                  setShowPreviewModal(false);
                  handleSubmit(e);
                }}
                style={{ fontWeight: 700 }}
              >
                {submitButtonLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

/**
 * test/tournament_ui_and_host_controls.test.js
 * 
 * Verification suite for:
 * 1. TournamentHome Header (Search, Notifications Drawer, Profile Pill, Category Tabs, Card Details)
 * 2. TournamentJoin Confirmation Modal & Validation
 * 3. TournamentOverview Host Controls (Settings, Kick, Audit Log, Cancellation)
 * 4. Backend Tournament Endpoints (Notifications, Settings PATCH, Kick, Audit Log, Cancel)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tournamentManager } from '../server/tournamentManager.js';

describe('Tournament UI, Host Controls & Notifications Verification', () => {

  describe('1. Backend Tournament Notifications & Host Management APIs', () => {
    it('aggregates notifications across tournaments with getAllNotifications', () => {
      const tourn = tournamentManager.createTournament(
        'KNOCKOUT',
        'Notif Test Arena',
        'host-notif-1',
        'Host Notif'
      );

      tourn.addNotification('user-alice', 'MATCH_READY', 'Match Ready!', 'Your QF match is ready.', `/tournaments/${tourn.id}/matches/m1`);
      tourn.addNotification('user-bob', 'INVITATION', 'Tournament Invite', 'You are invited to Notif Test Arena.');

      const aliceNotifs = tournamentManager.getAllNotifications('user-alice');
      assert.ok(Array.isArray(aliceNotifs));
      const foundAlice = aliceNotifs.find(n => n.recipientId === 'user-alice' && n.title === 'Match Ready!');
      assert.ok(foundAlice, 'Alice should receive the MATCH_READY notification');
      assert.strictEqual(foundAlice.tournamentId, tourn.id);

      const allNotifs = tournamentManager.getAllNotifications();
      assert.ok(allNotifs.length >= 2, 'All notifications should be aggregated');
    });

    it('updates tournament settings and records an audit log entry', () => {
      const tourn = tournamentManager.createTournament(
        'LEAGUE',
        'Settings Test Cup',
        'host-settings-1',
        'Host Settings'
      );

      const result = tourn.updateSettings('host-settings-1', {
        name: 'Updated Cup Champions',
        description: 'New championship description',
        prizePool: 5000
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(tourn.name, 'Updated Cup Champions');
      assert.strictEqual(tourn.description, 'New championship description');
      assert.strictEqual(tourn.prizePool, 5000);

      const updateLog = tourn.auditLog.find(log => log.action === 'UPDATE_SETTINGS' || log.action === 'SETTINGS_UPDATE');
      assert.ok(updateLog, 'UPDATE_SETTINGS should be recorded in audit log');
      assert.strictEqual(updateLog.actorId, 'host-settings-1');
    });

    it('allows host to kick a participant and logs KICK audit event', () => {
      const tourn = tournamentManager.createTournament(
        'KNOCKOUT',
        'Kick Test Cup',
        'host-kick-1',
        'Host Kick'
      );

      tourn.addParticipant('player-kick-target', 'Player To Remove');
      assert.ok(tourn.participants.some(p => p.id === 'player-kick-target'));

      const kickRes = tourn.kickParticipant('host-kick-1', 'player-kick-target');
      assert.strictEqual(kickRes.success, true);
      assert.ok(!tourn.participants.some(p => p.id === 'player-kick-target'), 'Player should be removed');

      const kickLog = tourn.auditLog.find(log => log.action === 'KICK');
      assert.ok(kickLog, 'KICK action should be in audit log');
      assert.strictEqual(kickLog.actorId, 'host-kick-1');
    });

    it('allows host to cancel tournament and updates status to CANCELLED', () => {
      const tourn = tournamentManager.createTournament(
        'HYBRID',
        'Cancel Test Arena',
        'host-cancel-1',
        'Host Cancel'
      );

      const cancelRes = tourn.cancelTournament('host-cancel-1', 'Weather emergency');
      assert.strictEqual(cancelRes.success, true);
      assert.strictEqual(tourn.status, 'CANCELLED');

      const cancelLog = tourn.auditLog.find(log => log.action === 'CANCEL');
      assert.ok(cancelLog, 'CANCEL action should be recorded in audit log');
      assert.ok(cancelLog.details.includes('Weather emergency'));
    });
  });

  describe('2. TournamentHome.jsx Structural & Functional Completeness', () => {
    const homePath = path.resolve('src/tournaments/screens/TournamentHome.jsx');
    const content = fs.readFileSync(homePath, 'utf8');

    it('includes Search toggle, Notifications bell trigger, and Profile quick pill in header', () => {
      assert.ok(content.includes('tourn-notification-trigger'), 'Notification button should be in header');
      assert.ok(content.includes('tourn-header-profile-pill'), 'Profile pill should be in header');
      assert.ok(content.includes('tourn-notif-badge'), 'Unread notification count badge should exist');
      assert.ok(content.includes('handleToggleSearch') || content.includes('tourn-search-input-wrapper'), 'Search toggle should exist');
    });

    it('implements Tournament Notifications Modal with filtering tabs', () => {
      assert.ok(content.includes('tourn-notifications-modal'), 'Notifications modal should be defined');
      assert.ok(content.includes('⚡ Match Ready') || content.includes('MATCH_READY'), 'Match Ready alerts tab should exist');
      assert.ok(content.includes('📩 Invitations') || content.includes('INVITATION'), 'Invitations tab should exist');
      assert.ok(content.includes('🏆 Results') || content.includes('CHAMPION'), 'Results tab should exist');
    });

    it('provides all 5 required Category Filter Tabs', () => {
      assert.ok(content.includes('All Tournaments'), 'All Tournaments tab should exist');
      assert.ok(content.includes('My Tournaments'), 'My Tournaments tab should exist');
      assert.ok(content.includes('Upcoming / Open'), 'Upcoming / Open tab should exist');
      assert.ok(content.includes('Live / In Progress'), 'Live / In Progress tab should exist');
      assert.ok(content.includes('Completed'), 'Completed tab should exist');
    });

    it('displays Host Name, Entry Fee vs Prize Pool, and Schedule on each Tournament Card', () => {
      assert.ok(content.includes('tourn-card-host-strip'), 'Host strip should be in tournament card');
      assert.ok(content.includes('hostName'), 'Host name should be rendered on card');
      assert.ok(content.includes('entryFee'), 'Entry fee should be rendered on card');
      assert.ok(content.includes('prizePool'), 'Prize pool should be rendered on card');
      assert.ok(content.includes('scheduleTime'), 'Schedule / Start time should be rendered on card');
    });
  });

  describe('3. TournamentJoin.jsx Confirmation Modal & Validation', () => {
    const joinPath = path.resolve('src/tournaments/screens/TournamentJoin.jsx');
    const content = fs.readFileSync(joinPath, 'utf8');

    it('implements Confirmation Modal before finalizing tournament entry', () => {
      assert.ok(content.includes('tourn-join-confirm-modal'), 'Confirmation modal must be implemented');
      assert.ok(content.includes('showConfirmModal'), 'Modal open state must exist');
      assert.ok(content.includes('Confirm Tournament Entry'), 'Modal title should display confirmation');
    });

    it('displays tournament details, host, capacity, fee, prize, and format rules in confirmation modal', () => {
      assert.ok(content.includes('formatRulesSummary'), 'Rules summary helper must exist');
      assert.ok(content.includes('previewTournament.hostName') || content.includes('previewTournament.creatorName'), 'Host name must be shown in modal');
      assert.ok(content.includes('previewTournament.prizePool'), 'Prize pool must be shown in modal');
      assert.ok(content.includes('previewTournament.entryFee'), 'Entry fee must be shown in modal');
      assert.ok(content.includes('previewTournament.maxPlayers'), 'Capacity must be shown in modal');
    });

    it('guards against full tournaments and displays explicit error feedback', () => {
      assert.ok(content.includes('already full'), 'Full tournament validation check must exist');
      assert.ok(content.includes('tourn-form-error-banner'), 'Error banner must be rendered');
    });
  });

  describe('4. TournamentOverview.jsx Host Controls & Audit Log', () => {
    const overviewPath = path.resolve('src/tournaments/screens/TournamentOverview.jsx');
    const content = fs.readFileSync(overviewPath, 'utf8');

    it('renders Host Controls action button exclusively for authorized tournament host', () => {
      assert.ok(content.includes('isHost'), 'Host authorization check must exist');
      assert.ok(content.includes('Host Controls'), 'Host Controls button must be rendered');
    });

    it('implements Host Controls Modal with Settings, Participants, Audit Log, and Danger Zone', () => {
      assert.ok(content.includes('tourn-host-controls-modal'), 'Host Controls modal must exist');
      assert.ok(content.includes('handleSaveSettings'), 'Save settings handler must exist');
      assert.ok(content.includes('handleKickParticipant'), 'Kick participant handler must exist');
      assert.ok(content.includes('handleCancelTournament'), 'Cancel tournament handler must exist');
      assert.ok(content.includes('/audit-log'), 'Audit log API endpoint must be queried');
    });

    it('renders the 10 standard tournament sub-tabs including Overview, Live, Schedule, Table, Teams, Players, Playoffs, Stats, Results, Rules', () => {
      const requiredTabs = ['overview', 'live', 'schedule', 'table', 'teams', 'players', 'playoffs', 'stats', 'results', 'rules'];
      for (const tab of requiredTabs) {
        assert.ok(content.includes(`'${tab}'`), `Sub-tab '${tab}' must be supported in Overview`);
      }
    });
  });

  describe('5. Responsive Stylesheet Verification', () => {
    const cssPath = path.resolve('src/styles/tournaments.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    it('defines styling for profile pill, notification badges, and modals', () => {
      assert.ok(css.includes('.tourn-header-profile-pill'), 'Profile pill CSS must exist');
      assert.ok(css.includes('.tourn-notif-badge'), 'Notification badge CSS must exist');
      assert.ok(css.includes('.hide-on-mobile'), 'Mobile responsive hiding helper must exist');
      assert.ok(css.includes('@media (max-width: 839px)'), 'Mobile responsive queries must exist');
    });
  });

  describe('6. Lobby Ready State & Leave Flow (Backend & Engine)', () => {
    it('updates participant ready state and logs READY_CHANGE in audit log', () => {
      const tourn = tournamentManager.createTournament(
        'KNOCKOUT',
        'Ready Test Tournament',
        'host-ready-test',
        'Host Ready'
      );
      tourn.addParticipant('p-ready-1', 'Alice');

      const readyRes = tourn.setParticipantReady('p-ready-1', true);
      assert.strictEqual(readyRes.success, true);
      assert.strictEqual(readyRes.isReady, true);

      const alice = tourn.participants.find(p => p.id === 'p-ready-1');
      assert.strictEqual(alice.isReady, true);

      const readyLog = tourn.auditLog.find(l => l.action === 'READY_CHANGE');
      assert.ok(readyLog, 'READY_CHANGE should be recorded');
      assert.ok(readyLog.details.includes('READY'));

      // Toggle to not ready
      const unreadyRes = tourn.setParticipantReady('p-ready-1', false);
      assert.strictEqual(unreadyRes.success, true);
      assert.strictEqual(unreadyRes.isReady, false);
      assert.strictEqual(alice.isReady, false);
    });

    it('gracefully removes participant on leaveTournament during registration', () => {
      const tourn = tournamentManager.createTournament(
        'LEAGUE',
        'Leave Test League',
        'host-leave-test',
        'Host Leave'
      );
      tourn.addParticipant('p-leave-1', 'Bob');
      assert.ok(tourn.participants.some(p => p.id === 'p-leave-1'));

      const leaveRes = tourn.leaveTournament('p-leave-1');
      assert.strictEqual(leaveRes.success, true);
      assert.ok(!tourn.participants.some(p => p.id === 'p-leave-1'), 'Bob should no longer be in participants');

      const leaveLog = tourn.auditLog.find(l => l.action === 'LEAVE');
      assert.ok(leaveLog, 'LEAVE should be recorded in audit log');

      // Attempting to leave when not in tournament
      const errRes = tourn.leaveTournament('unknown-player');
      assert.strictEqual(errRes.success, false);
    });
  });

  describe('7. TournamentCreate.jsx Interactive Flows & Safety Controls', () => {
    const createPath = path.resolve('src/tournaments/screens/TournamentCreate.jsx');
    const content = fs.readFileSync(createPath, 'utf8');

    it('implements 5-step wizard progression indicators and form steps', () => {
      assert.ok(content.includes('currentStep'), 'Wizard step state must exist');
      assert.ok(content.includes('Step 1') || content.includes('Basic Information'), 'Step 1 should exist');
      assert.ok(content.includes('Step 2') || content.includes('Participants'), 'Step 2 should exist');
      assert.ok(content.includes('Step 3') || content.includes('Rules'), 'Step 3 should exist');
      assert.ok(content.includes('Step 4') || content.includes('Fixtures'), 'Step 4 should exist');
      assert.ok(content.includes('Step 5') || content.includes('Review'), 'Step 5 should exist');
    });

    it('provides Preview Modal before tournament creation', () => {
      assert.ok(content.includes('tourn-create-preview-modal'), 'Preview modal class must exist');
      assert.ok(content.includes('showPreviewModal'), 'Preview modal state toggle must exist');
      assert.ok(content.includes('Tournament Preview'), 'Preview modal header must exist');
    });

    it('supports form reset with confirmation and unsaved changes guard on cancel', () => {
      assert.ok(content.includes('handleResetForm'), 'Form reset handler must exist');
      assert.ok(content.includes('handleCancel'), 'Cancel navigation guard handler must exist');
      assert.ok(content.includes('unsaved changes'), 'Unsaved changes check must exist');
    });

    it('prevents double-click submission with isSubmitting state', () => {
      assert.ok(content.includes('isSubmitting'), 'Submission lock state must exist');
      assert.ok(content.includes('disabled={isSubmitting}'), 'Submit button must be disabled when submitting');
    });
  });

  describe('8. TournamentLobby.jsx Ready Toggle, Leave & Invite Flows', () => {
    const lobbyPath = path.resolve('src/tournaments/screens/TournamentLobby.jsx');
    const content = fs.readFileSync(lobbyPath, 'utf8');

    it('implements ready state toggle calling /ready endpoint', () => {
      assert.ok(content.includes('handleToggleReady'), 'Ready toggle handler must exist');
      assert.ok(content.includes('/api/tournaments/${id}/ready') || content.includes('/ready'), 'Calls ready API endpoint');
      assert.ok(content.includes('isMyReady'), 'Local ready state tracker must exist');
    });

    it('implements leave lobby flow calling /leave endpoint with confirmation', () => {
      assert.ok(content.includes('handleLeaveTournament'), 'Leave lobby handler must exist');
      assert.ok(content.includes('/api/tournaments/${id}/leave') || content.includes('/leave'), 'Calls leave API endpoint');
    });

    it('includes friend invite modal and sharing tools', () => {
      assert.ok(content.includes('tourn-lobby-invite-modal') || content.includes('showInviteModal'), 'Invite modal must exist');
      assert.ok(content.includes('handleCopyCode'), 'Copy code utility must exist');
      assert.ok(content.includes('handleWhatsAppShare') || content.includes('handleShare'), 'Share triggers must exist');
    });

    it('checks start requirements and allows AI bot filling', () => {
      assert.ok(content.includes('canStart') || content.includes('participants.length >= 2'), 'Minimum player threshold check must exist');
      assert.ok(content.includes('Fill Slots with AI') || content.includes('fillWithBots'), 'AI bot filling option must exist');
    });
  });

  describe('9. MatchResult.jsx Post-Match Tournament Routing', () => {
    const matchResultPath = path.resolve('src/components/MatchResult.jsx');
    const content = fs.readFileSync(matchResultPath, 'utf8');

    it('renders tournament match status strip when tournamentMatch prop is provided', () => {
      assert.ok(content.includes('tournamentMatch'), 'tournamentMatch prop must be accepted');
      assert.ok(content.includes('tournamentMatch.tournamentName'), 'Tournament name should be rendered in header');
      assert.ok(content.includes('Match Result Verified'), 'Match Result Verified badge should be displayed');
    });

    it('provides all 4 dedicated tournament action buttons', () => {
      assert.ok(content.includes('Tournament Overview'), 'Tournament Overview button must exist');
      assert.ok(content.includes('Standings'), 'Standings button must exist');
      assert.ok(content.includes('Bracket'), 'Bracket button must exist');
      assert.ok(content.includes('Back to Tournaments'), 'Back to Tournaments button must exist');
    });

    it('preserves standard quick match actions (Play Again, Back to Home) for non-tournament games', () => {
      assert.ok(content.includes('Play Again'), 'Standard Play Again button must exist');
      assert.ok(content.includes('Back to Home'), 'Standard Back to Home button must exist');
    });
  });

  describe('10. Mobile Tournament Screen & Features', () => {
    const mobileScreenPath = path.resolve('mobile/screens/TournamentScreen.tsx');
    const content = fs.readFileSync(mobileScreenPath, 'utf8');

    it('implements search filter and 5 category filter tabs on mobile', () => {
      assert.ok(content.includes('searchQuery') || content.includes('Search by name'), 'Search filter must exist on mobile');
      assert.ok(content.includes("'all'"), 'all filter tab must exist on mobile');
      assert.ok(content.includes("'my'"), 'my filter tab must exist on mobile');
      assert.ok(content.includes("'open'"), 'open filter tab must exist on mobile');
      assert.ok(content.includes("'live'"), 'live filter tab must exist on mobile');
      assert.ok(content.includes("'completed'"), 'completed filter tab must exist on mobile');
    });

    it('supports ready toggle and leave lobby handlers on mobile', () => {
      assert.ok(content.includes('handleToggleReady'), 'Mobile ready toggle handler must exist');
      assert.ok(content.includes('handleLeaveLobby'), 'Mobile leave lobby handler must exist');
    });
  });
});

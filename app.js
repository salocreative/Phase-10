(() => {
  'use strict';

  const STORAGE_KEY = 'phase10.session.v1';

  const PHASES = [
    { number: 1, name: '2 sets of 3' },
    { number: 2, name: '1 set of 3 + 1 run of 4' },
    { number: 3, name: '1 set of 4 + 1 run of 4' },
    { number: 4, name: '1 run of 7' },
    { number: 5, name: '1 run of 8' },
    { number: 6, name: '1 run of 9' },
    { number: 7, name: '2 sets of 4' },
    { number: 8, name: '7 cards of one color' },
    { number: 9, name: '1 set of 5 + 1 set of 2' },
    { number: 10, name: '1 set of 5 + 1 set of 3' },
  ];
  const MAX_PHASE = PHASES.length;

  /**
   * Session state shape:
   * {
   *   started: bool,
   *   round: number,
   *   players: [{ id, name, phase, score }],
   *   history: [{ round, entries: [{ playerId, name, points, completed, phaseAtRound }] }]
   * }
   */
  let state = loadState() || freshState();

  function freshState() {
    return { started: false, round: 1, players: [], history: [] };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable — session just won't persist across reloads */
    }
  }

  function phaseInfo(num) {
    return PHASES[Math.min(num, MAX_PHASE) - 1];
  }

  function uid() {
    return 'p' + Math.random().toString(36).slice(2, 9);
  }

  // ---------- DOM refs ----------
  const setupScreen = document.getElementById('setupScreen');
  const gameScreen = document.getElementById('gameScreen');
  const newGameBtn = document.getElementById('newGameBtn');

  const addPlayerForm = document.getElementById('addPlayerForm');
  const playerNameInput = document.getElementById('playerNameInput');
  const playerList = document.getElementById('playerList');
  const setupHint = document.getElementById('setupHint');
  const startGameBtn = document.getElementById('startGameBtn');
  const playerListItemTemplate = document.getElementById('playerListItemTemplate');

  const roundNumberEl = document.getElementById('roundNumber');
  const roundEntryNumberEl = document.getElementById('roundEntryNumber');
  const scoreboardBody = document.getElementById('scoreboardBody');
  const winnerBanner = document.getElementById('winnerBanner');
  const roundEntryList = document.getElementById('roundEntryList');
  const roundEntryRowTemplate = document.getElementById('roundEntryRowTemplate');
  const submitRoundBtn = document.getElementById('submitRoundBtn');

  const toggleHistoryBtn = document.getElementById('toggleHistoryBtn');
  const historyBody = document.getElementById('historyBody');

  // ---------- Setup screen ----------
  addPlayerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = playerNameInput.value.trim();
    if (!name) return;
    state.players.push({ id: uid(), name, phase: 1, score: 0 });
    playerNameInput.value = '';
    playerNameInput.focus();
    saveState();
    renderSetup();
  });

  playerList.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-player-btn');
    if (!btn) return;
    const li = btn.closest('.player-list-item');
    const id = li.dataset.id;
    state.players = state.players.filter((p) => p.id !== id);
    saveState();
    renderSetup();
  });

  startGameBtn.addEventListener('click', () => {
    if (state.players.length < 2) return;
    state.started = true;
    state.round = 1;
    saveState();
    render();
  });

  function renderSetup() {
    playerList.innerHTML = '';
    state.players.forEach((p) => {
      const node = playerListItemTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.id = p.id;
      node.querySelector('.player-name').textContent = p.name;
      playerList.appendChild(node);
    });

    const enough = state.players.length >= 2;
    startGameBtn.disabled = !enough;
    setupHint.textContent = enough
      ? `${state.players.length} players ready.`
      : 'Add at least 2 players to start.';
  }

  // ---------- Game screen ----------
  function render() {
    const isStarted = state.started;
    setupScreen.classList.toggle('hidden', isStarted);
    gameScreen.classList.toggle('hidden', !isStarted);
    newGameBtn.classList.toggle('hidden', !isStarted && state.players.length === 0);

    if (!isStarted) {
      renderSetup();
      return;
    }

    roundNumberEl.textContent = state.round;
    roundEntryNumberEl.textContent = state.round;

    renderScoreboard();
    renderWinnerBanner();
    renderRoundEntry();
    renderHistory();
  }

  function sortedPlayers() {
    // Highest phase first, then lowest score (Phase 10 leaderboard convention)
    return [...state.players].sort((a, b) => b.phase - a.phase || a.score - b.score);
  }

  function renderScoreboard() {
    scoreboardBody.innerHTML = '';
    sortedPlayers().forEach((p) => {
      const complete = p.phase > MAX_PHASE;
      const tr = document.createElement('tr');

      const nameTd = document.createElement('td');
      nameTd.textContent = p.name;

      const phaseTd = document.createElement('td');
      const pill = document.createElement('span');
      pill.className = 'phase-pill' + (complete ? ' complete' : '');
      pill.textContent = complete ? 'All 10 done!' : `Phase ${p.phase}`;
      phaseTd.appendChild(pill);
      if (!complete) {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'phase-name';
        nameSpan.textContent = phaseInfo(p.phase).name;
        phaseTd.appendChild(nameSpan);
      }

      const scoreTd = document.createElement('td');
      scoreTd.className = 'col-score';
      scoreTd.textContent = p.score;

      tr.append(nameTd, phaseTd, scoreTd);
      scoreboardBody.appendChild(tr);
    });
  }

  function renderWinnerBanner() {
    const finishers = state.players.filter((p) => p.phase > MAX_PHASE);
    if (finishers.length === 0) {
      winnerBanner.classList.add('hidden');
      return;
    }
    const leader = [...finishers].sort((a, b) => a.score - b.score)[0];
    winnerBanner.classList.remove('hidden');
    winnerBanner.textContent =
      finishers.length === 1
        ? `🏆 ${leader.name} completed all 10 phases! (lowest score wins if others also finish)`
        : `🏆 ${leader.name} leads among ${finishers.length} players who completed all 10 phases!`;
  }

  function renderRoundEntry() {
    roundEntryList.innerHTML = '';
    state.players.forEach((p) => {
      const row = roundEntryRowTemplate.content.firstElementChild.cloneNode(true);
      row.dataset.id = p.id;
      row.querySelector('.round-entry-player').textContent = p.name;

      const phaseEl = row.querySelector('.round-entry-phase');
      const finished = p.phase > MAX_PHASE;
      phaseEl.textContent = finished
        ? 'Finished all 10 phases'
        : `Phase ${p.phase}: ${phaseInfo(p.phase).name}`;

      const completeInput = row.querySelector('.round-complete-input');
      if (finished) {
        completeInput.disabled = true;
        completeInput.closest('.round-entry-checkbox').style.opacity = '0.4';
      }

      roundEntryList.appendChild(row);
    });
  }

  submitRoundBtn.addEventListener('click', () => {
    const rows = roundEntryList.querySelectorAll('.round-entry-row');
    const entries = [];

    rows.forEach((row) => {
      const id = row.dataset.id;
      const player = state.players.find((p) => p.id === id);
      if (!player) return;

      const pointsInput = row.querySelector('.round-points-input');
      const completeInput = row.querySelector('.round-complete-input');
      const points = parseInt(pointsInput.value, 10) || 0;
      const completed = completeInput.checked && !completeInput.disabled;
      const phaseAtRound = player.phase;

      player.score += points;
      if (completed && player.phase <= MAX_PHASE) {
        player.phase += 1;
      }

      entries.push({ playerId: id, name: player.name, points, completed, phaseAtRound });
    });

    state.history.push({ round: state.round, entries });
    state.round += 1;
    saveState();
    render();
  });

  // ---------- History ----------
  toggleHistoryBtn.addEventListener('click', () => {
    const isHidden = historyBody.classList.toggle('hidden');
    toggleHistoryBtn.textContent = isHidden ? 'Show Round History' : 'Hide Round History';
  });

  function renderHistory() {
    historyBody.innerHTML = '';
    [...state.history].reverse().forEach((round) => {
      const card = document.createElement('div');
      card.className = 'history-round';

      const h3 = document.createElement('h3');
      h3.textContent = `Round ${round.round}`;
      card.appendChild(h3);

      round.entries.forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'history-row';

        const label = document.createElement('span');
        label.textContent = `${entry.name} — Phase ${Math.min(entry.phaseAtRound, MAX_PHASE)}`;

        const detail = document.createElement('span');
        detail.className = entry.completed ? 'hr-done' : 'hr-notdone';
        detail.textContent = `+${entry.points} pts ${entry.completed ? '✓ advanced' : '— stayed'}`;

        row.append(label, detail);
        card.appendChild(row);
      });

      historyBody.appendChild(card);
    });
  }

  // ---------- New game ----------
  newGameBtn.addEventListener('click', () => {
    if (!confirm('Start a new game? This clears the current session.')) return;
    state = freshState();
    saveState();
    historyBody.classList.add('hidden');
    toggleHistoryBtn.textContent = 'Show Round History';
    render();
  });

  // ---------- Init ----------
  render();
})();

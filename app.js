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
   *   players: [{ id, name, phase, score }],  // array order == seating/deal order
   *   dealerId: string | null,
   *   history: [{ round, entries: [{ playerId, name, points, completed, phaseAtRound }] }]
   * }
   */
  let state = loadState() || freshState();

  function freshState() {
    return { started: false, round: 1, players: [], dealerId: null, history: [] };
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
  const landingIntro = document.getElementById('landingIntro');
  const setupScreen = document.getElementById('setupScreen');
  const gameScreen = document.getElementById('gameScreen');
  const newGameBtn = document.getElementById('newGameBtn');

  const addPlayerForm = document.getElementById('addPlayerForm');
  const playerNameInput = document.getElementById('playerNameInput');
  const playerList = document.getElementById('playerList');
  const setupHint = document.getElementById('setupHint');
  const startGameBtn = document.getElementById('startGameBtn');
  const playerListItemTemplate = document.getElementById('playerListItemTemplate');
  const addPlayersHeading = document.getElementById('addPlayersHeading');
  const jumpToSetupBtn = document.getElementById('jumpToSetupBtn');

  const roundNumberEl = document.getElementById('roundNumber');
  const dealerNameEl = document.getElementById('dealerName');
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
    const li = e.target.closest('.player-list-item');
    if (!li) return;
    const id = li.dataset.id;

    if (e.target.closest('.remove-player-btn')) {
      state.players = state.players.filter((p) => p.id !== id);
      ensureDealer();
      saveState();
      renderSetup();
      return;
    }
  });

  playerList.addEventListener('change', (e) => {
    if (!e.target.classList.contains('dealer-radio-input')) return;
    const li = e.target.closest('.player-list-item');
    state.dealerId = li.dataset.id;
    saveState();
    renderSetup();
  });

  // Keyboard fallback for reordering: focus a drag handle, press Up/Down.
  playerList.addEventListener('keydown', (e) => {
    if (!e.target.classList.contains('drag-handle')) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const li = e.target.closest('.player-list-item');
    const id = li.dataset.id;
    movePlayer(id, e.key === 'ArrowUp' ? -1 : 1);
    requestAnimationFrame(() => {
      playerList.querySelector(`.player-list-item[data-id="${id}"] .drag-handle`)?.focus();
    });
  });

  function movePlayer(id, direction) {
    const index = state.players.findIndex((p) => p.id === id);
    const swapWith = index + direction;
    if (index === -1 || swapWith < 0 || swapWith >= state.players.length) return;
    [state.players[index], state.players[swapWith]] = [state.players[swapWith], state.players[index]];
    saveState();
    renderSetup();
  }

  // ---------- Drag-to-reorder ----------
  // Native touch + mouse events (rather than Pointer Events) — the most
  // broadly compatible combination on mobile Safari, where Pointer Event
  // support for setPointerCapture/preventDefault has been inconsistent.
  let drag = null;

  function getClientY(e) {
    return e.touches && e.touches.length ? e.touches[0].clientY : e.clientY;
  }

  function startDrag(e) {
    if (drag) return;
    const handle = e.target.closest('.drag-handle');
    const li = handle && handle.closest('.player-list-item');
    if (!li) return;
    e.preventDefault();

    const items = [...playerList.querySelectorAll('.player-list-item')];
    drag = {
      touch: e.type === 'touchstart',
      li,
      index: items.indexOf(li),
      targetIndex: items.indexOf(li),
      startY: getClientY(e),
      items,
      rects: items.map((el) => el.getBoundingClientRect()),
    };

    li.classList.add('dragging');

    if (drag.touch) {
      document.addEventListener('touchmove', onDragMove, { passive: false });
      document.addEventListener('touchend', endDrag);
      document.addEventListener('touchcancel', endDrag);
    } else {
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', endDrag);
    }
  }

  playerList.addEventListener('mousedown', startDrag);
  playerList.addEventListener('touchstart', startDrag, { passive: false });

  function onDragMove(e) {
    if (!drag) return;
    e.preventDefault();
    const dy = getClientY(e) - drag.startY;
    drag.li.style.transform = `translateY(${dy}px)`;

    const rowHeight = drag.rects[drag.index].height;
    const pointerCenter = drag.rects[drag.index].top + rowHeight / 2 + dy;
    const firstTop = drag.rects[0].top;

    let targetIndex = Math.round((pointerCenter - firstTop) / rowHeight - 0.5);
    targetIndex = Math.max(0, Math.min(drag.items.length - 1, targetIndex));
    drag.targetIndex = targetIndex;

    // Shift the other rows out of the way to preview where the dragged row will land.
    drag.items.forEach((el, i) => {
      if (i === drag.index) return;
      let shift = 0;
      if (drag.index < targetIndex && i > drag.index && i <= targetIndex) shift = -rowHeight;
      else if (drag.index > targetIndex && i < drag.index && i >= targetIndex) shift = rowHeight;
      el.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  }

  function endDrag() {
    if (!drag) return;
    const { index, targetIndex, items, touch } = drag;

    if (touch) {
      document.removeEventListener('touchmove', onDragMove);
      document.removeEventListener('touchend', endDrag);
      document.removeEventListener('touchcancel', endDrag);
    } else {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', endDrag);
    }

    items.forEach((el) => { el.style.transform = ''; });
    drag.li.classList.remove('dragging');
    drag = null;

    if (targetIndex !== index) {
      const [moved] = state.players.splice(index, 1);
      state.players.splice(targetIndex, 0, moved);
      saveState();
    }
    renderSetup();
  }

  startGameBtn.addEventListener('click', () => {
    if (state.players.length < 2) return;
    state.started = true;
    state.round = 1;
    saveState();
    render();
  });

  // Keep dealerId pointing at a real player, defaulting to the first in
  // seating order. Also repairs sessions saved before dealers existed.
  function ensureDealer() {
    if (state.players.some((p) => p.id === state.dealerId)) return;
    const nextDealerId = state.players[0] ? state.players[0].id : null;
    if (nextDealerId !== state.dealerId) {
      state.dealerId = nextDealerId;
      saveState();
    }
  }

  function renderSetup() {
    ensureDealer();

    playerList.innerHTML = '';
    state.players.forEach((p) => {
      const node = playerListItemTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.id = p.id;
      node.querySelector('.player-name').textContent = p.name;

      const dealerInput = node.querySelector('.dealer-radio-input');
      dealerInput.checked = p.id === state.dealerId;

      playerList.appendChild(node);
    });

    const enough = state.players.length >= 2;
    startGameBtn.disabled = !enough;
    setupHint.textContent = enough
      ? `${state.players.length} players ready. ${state.players.find((p) => p.id === state.dealerId)?.name || ''} deals first.`
      : 'Add at least 2 players to start.';
  }

  // ---------- Mobile "jump to Add Players" button ----------
  // Shown (small screens only, via CSS) while the intro content is scrolled
  // past but the Add Players heading hasn't come into view yet.
  let addPlayersHeadingInView = false;

  function updateJumpButton() {
    jumpToSetupBtn.classList.toggle('jump-fab-visible', !state.started && !addPlayersHeadingInView);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        addPlayersHeadingInView = entries[0].isIntersecting;
        updateJumpButton();
      },
      { rootMargin: '0px 0px -25% 0px' }
    ).observe(addPlayersHeading);
  }

  jumpToSetupBtn.addEventListener('click', () => {
    addPlayersHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- Intro tabs (How it works / FAQ) ----------
  const introTabButtons = document.querySelectorAll('[data-intro-tab]');

  function activateIntroTab(name) {
    introTabButtons.forEach((btn) => {
      const selected = btn.dataset.introTab === name;
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      btn.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (panel) panel.toggleAttribute('hidden', !selected);
    });
  }

  introTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => activateIntroTab(btn.dataset.introTab));
    btn.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const tabs = [...introTabButtons];
      const index = tabs.indexOf(btn);
      const next = event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : (index - 1 + tabs.length) % tabs.length;
      tabs[next].focus();
      activateIntroTab(tabs[next].dataset.introTab);
    });
  });

  // ---------- Game screen ----------
  function render() {
    const isStarted = state.started;
    landingIntro.classList.toggle('hidden', isStarted);
    setupScreen.classList.toggle('hidden', isStarted);
    gameScreen.classList.toggle('hidden', !isStarted);
    newGameBtn.classList.toggle('hidden', !isStarted && state.players.length === 0);
    updateJumpButton();

    if (!isStarted) {
      renderSetup();
      return;
    }

    // Repairs sessions saved before dealer tracking existed, where a game
    // may already be in progress with no dealerId set.
    ensureDealer();

    roundNumberEl.textContent = state.round;
    roundEntryNumberEl.textContent = state.round;
    const dealer = state.players.find((p) => p.id === state.dealerId);
    dealerNameEl.textContent = dealer ? dealer.name : '—';

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

      const isDealer = p.id === state.dealerId;
      if (isDealer) tr.classList.add('dealer-row');

      const nameTd = document.createElement('td');
      nameTd.textContent = p.name;
      if (isDealer) {
        const badge = document.createElement('span');
        badge.className = 'dealer-badge';
        badge.title = 'Dealer';
        badge.textContent = '🎲';
        nameTd.appendChild(badge);
      }

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
      const isDealer = p.id === state.dealerId;
      if (isDealer) row.classList.add('dealer-row');
      row.querySelector('.round-entry-player').textContent = p.name + (isDealer ? ' 🎲' : '');

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
    advanceDealer();
    saveState();
    render();
  });

  function advanceDealer() {
    // Deal passes to the next player in seating order each round.
    const count = state.players.length;
    if (count === 0) {
      state.dealerId = null;
      return;
    }
    const currentIndex = state.players.findIndex((p) => p.id === state.dealerId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % count;
    state.dealerId = state.players[nextIndex].id;
  }

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

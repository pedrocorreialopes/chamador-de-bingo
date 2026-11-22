(() => {
  'use strict';

  const STORAGE_KEYS = {
    active: 'bingo75.activeGame',
    backup: 'bingo75.backupGame',
    finalized: 'bingo75.finalizedGame',
    settings: 'bingo75.settings'
  };

  const LETTERS = [
    { letter: 'B', from: 1, to: 15, color: '#2a61ff' },
    { letter: 'I', from: 16, to: 30, color: '#e0465f' },
    { letter: 'N', from: 31, to: 45, color: '#d9ae2c' },
    { letter: 'G', from: 46, to: 60, color: '#2fb56f' },
    { letter: 'O', from: 61, to: 75, color: '#9457ff' }
  ];

  const defaultSettings = {
    intervalSec: 10,
    autoDraw: true,
    soundOn: true,
    volume: 0.4,
    animationsOn: true,
    animSpeed: 1,
    historyMode: 'all',
    confirmNewGame: true,
    autoRecovery: true,
    theme: 'dark'
  };

  const els = {};
  let settings = loadSettings();
  let state = createEmptyState();
  let countdownTimer = null;
  let elapsedTimer = null;
  let audioCtx = null;

  function createEmptyState() {
    return {
      game: {
        id: null,
        startedAt: null,
        endedAt: null,
        status: 'idle', // idle|running|paused|finished
        drawnNumbers: [],
        availableNumbers: [],
        currentDraw: null,
        previousDraw: null,
        intervalSec: settings.intervalSec,
        countdownRemaining: settings.intervalSec,
        autoDraw: settings.autoDraw,
        lastActionAt: null
      },
      pedraMaior: {
        participants: [],
        lastWinner: null,
        draws: []
      }
    };
  }

  function cacheElements() {
    const ids = [
      'bingoGrid', 'currentBall', 'currentLetter', 'currentNumber', 'prevDraw', 'lastDraw', 'countdown',
      'btnStart', 'btnPause', 'btnResume', 'btnDraw', 'btnFinish', 'btnNewGame', 'btnPedra', 'btnRecover', 'btnTelo',
      'historyList', 'statDrawn', 'statRemain', 'statPct', 'statTime', 'progressFill',
      'settingsDrawer', 'btnSettings', 'closeSettings',
      'cfgIntervalPreset', 'cfgIntervalCustom', 'cfgAuto', 'cfgSound', 'cfgVolume', 'cfgAnim', 'cfgAnimSpeed',
      'cfgHistoryMode', 'cfgConfirmNew', 'cfgAutoRecovery', 'cfgTheme', 'saveSettings',
      'recoverDialog', 'recoverInfo', 'recoverDo', 'recoverCancel',
      'pedraDialog', 'pedraNameInput', 'pedraAdd', 'pedraList', 'pedraDraw', 'pedraReset', 'pedraClose', 'pedraWinner'
    ];
    ids.forEach((id) => { els[id] = document.getElementById(id); });
  }

  function setup() {
    cacheElements();
    buildBoard();
    bindEvents();
    hydrateSettingsUI();
    applyTheme(settings.theme);

    const recovered = safeRead(STORAGE_KEYS.active);
    if (recovered?.game) {
      state = recovered;
      normalizeRecoveredState();
      renderAll();
      startElapsedTimer();
      if (state.game.status === 'running') startCountdown();
    } else {
      renderAll();
    }

    // Auto sugestão de recuperação (backup/finalizado)
    if (settings.autoRecovery) {
      const candidate = getRecoverCandidate();
      if (candidate && (!state.game.id || candidate.game.id !== state.game.id)) {
        const ask = confirm(`Foi encontrado um jogo salvo (${candidate.game.status}) com ${candidate.game.drawnNumbers.length} bolas sorteadas. Deseja restaurar agora?`);
        if (ask) {
          state = candidate;
          normalizeRecoveredState();
          persistState('recovery');
          renderAll();
          startElapsedTimer();
          if (state.game.status === 'running') startCountdown();
        }
      }
    }
  }

  function normalizeRecoveredState() {
    const g = state.game;
    g.drawnNumbers = Array.isArray(g.drawnNumbers) ? g.drawnNumbers : [];
    g.availableNumbers = Array.isArray(g.availableNumbers) ? g.availableNumbers : [];
    g.intervalSec = Number(g.intervalSec || settings.intervalSec);
    g.countdownRemaining = Number(g.countdownRemaining || g.intervalSec);
    g.autoDraw = typeof g.autoDraw === 'boolean' ? g.autoDraw : settings.autoDraw;

    state.pedraMaior = state.pedraMaior || { participants: [], lastWinner: null, draws: [] };
    state.pedraMaior.participants = state.pedraMaior.participants || [];
    state.pedraMaior.draws = state.pedraMaior.draws || [];
  }

  function buildBoard() {
    els.bingoGrid.innerHTML = '';
    LETTERS.forEach((group) => {
      const col = document.createElement('div');
      col.className = 'col';
      col.dataset.letter = group.letter;

      const head = document.createElement('div');
      head.className = 'col-header';
      head.textContent = group.letter;
      col.appendChild(head);

      for (let n = group.from; n <= group.to; n += 1) {
        const ball = document.createElement('div');
        ball.className = 'num-ball';
        ball.id = `ball-${n}`;
        ball.textContent = String(n).padStart(2, '0');
        col.appendChild(ball);
      }
      els.bingoGrid.appendChild(col);
    });
  }

  function bindEvents() {
    els.btnStart.addEventListener('click', startGame);
    els.btnPause.addEventListener('click', pauseGame);
    els.btnResume.addEventListener('click', resumeGame);
    els.btnDraw.addEventListener('click', drawNextBall);
    els.btnFinish.addEventListener('click', finishGame);
    els.btnNewGame.addEventListener('click', newGame);
    els.btnRecover.addEventListener('click', openRecoveryDialog);
    els.btnTelo.addEventListener('click', toggleTeloMode);
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && document.body.classList.contains('telao')) {
        exitTeloMode();
      }
    });

    els.btnSettings.addEventListener('click', () => toggleSettings(true));
    els.closeSettings.addEventListener('click', () => toggleSettings(false));
    els.saveSettings.addEventListener('click', saveSettingsFromUI);

    els.recoverCancel.addEventListener('click', () => els.recoverDialog.close());
    els.recoverDo.addEventListener('click', restoreCandidateFromDialog);

    els.btnPedra.addEventListener('click', openPedraDialog);
    els.pedraAdd.addEventListener('click', addPedraParticipant);
    els.pedraDraw.addEventListener('click', drawPedraMaior);
    els.pedraReset.addEventListener('click', resetPedraParticipants);
    els.pedraClose.addEventListener('click', () => els.pedraDialog.close());
  }

  function getLetterByNumber(n) {
    return LETTERS.find((x) => n >= x.from && n <= x.to)?.letter || '-';
  }

  function startGame() {
    if (state.game.status === 'running') return;

    if (state.game.status === 'paused') {
      resumeGame();
      return;
    }

    const hasPreviousProgress = state.game.drawnNumbers.length > 0 && state.game.status !== 'finished';
    if (hasPreviousProgress) {
      const ok = confirm('Existe uma partida em andamento. Deseja iniciar uma nova partida e preservar backup da anterior?');
      if (!ok) return;
    }

    archiveCurrentToBackup();
    state = createEmptyState();

    const nums = Array.from({ length: 75 }, (_, i) => i + 1);
    fisherYatesShuffle(nums);

    state.game.id = `PARTIDA-${Date.now()}`;
    state.game.startedAt = new Date().toISOString();
    state.game.endedAt = null;
    state.game.status = 'running';
    state.game.drawnNumbers = [];
    state.game.availableNumbers = nums;
    state.game.currentDraw = null;
    state.game.previousDraw = null;
    state.game.intervalSec = getCurrentInterval();
    state.game.countdownRemaining = state.game.intervalSec;
    state.game.autoDraw = settings.autoDraw;
    state.game.lastActionAt = new Date().toISOString();

    clearBoardMarks();
    persistState('start');
    renderAll();
    startElapsedTimer();
    startCountdown();
    beep('start');

    if (!state.game.autoDraw) {
      stopCountdown();
      els.countdown.textContent = 'Manual';
    }
  }

  function pauseGame() {
    if (state.game.status !== 'running') return;
    state.game.status = 'paused';
    state.game.lastActionAt = new Date().toISOString();
    stopCountdown();
    persistState('pause');
    renderAll();
    beep('pause');
  }

  function resumeGame() {
    if (state.game.status !== 'paused') return;
    state.game.status = 'running';
    state.game.lastActionAt = new Date().toISOString();
    persistState('resume');
    renderAll();
    beep('resume');
    if (state.game.autoDraw) startCountdown();
  }

  function finishGame() {
    if (!state.game.id || state.game.status === 'idle') return;
    const ok = confirm('Deseja finalizar a partida atual? O estado completo será preservado.');
    if (!ok) return;

    state.game.status = 'finished';
    state.game.endedAt = new Date().toISOString();
    state.game.lastActionAt = new Date().toISOString();
    stopCountdown();
    stopElapsedTimer();

    safeWrite(STORAGE_KEYS.finalized, state);
    persistState('finish');
    renderAll();
    beep('finish');
  }

  function newGame() {
    if (settings.confirmNewGame) {
      const ok = confirm('Confirmar NOVO JOGO? O jogo atual será preservado em backup, sem apagamento automático.');
      if (!ok) return;
    }
    archiveCurrentToBackup();
    state = createEmptyState();
    stopCountdown();
    stopElapsedTimer();
    persistState('new_game');
    renderAll();
  }

  function drawNextBall() {
    if (state.game.status === 'idle') {
      alert('Inicie o jogo primeiro.');
      return;
    }
    if (state.game.status === 'finished') {
      alert('A partida já foi finalizada. Inicie um novo jogo para continuar.');
      return;
    }
    if (state.game.availableNumbers.length === 0) {
      alert('Todas as 75 bolas já foram sorteadas.');
      finishGameAuto();
      return;
    }

    if (state.game.status === 'paused') {
      // Sorteio manual pode ocorrer mesmo pausado
    }

    animateBall();
    beep('spin');

    const next = state.game.availableNumbers.shift();
    state.game.previousDraw = state.game.currentDraw;
    state.game.currentDraw = next;
    state.game.drawnNumbers.push(next);
    state.game.lastActionAt = new Date().toISOString();

    if (state.game.autoDraw && state.game.status === 'running') {
      state.game.countdownRemaining = state.game.intervalSec;
    }

    if (state.game.drawnNumbers.length >= 75) {
      finishGameAuto();
    }

    persistState('draw');
    renderAll();
    beep('reveal');
  }

  function finishGameAuto() {
    state.game.status = 'finished';
    state.game.endedAt = new Date().toISOString();
    stopCountdown();
    stopElapsedTimer();
    safeWrite(STORAGE_KEYS.finalized, state);
    persistState('auto_finish');
  }

  function startCountdown() {
    stopCountdown();
    if (!state.game.autoDraw || state.game.status !== 'running') return;

    countdownTimer = setInterval(() => {
      if (state.game.status !== 'running') return;
      state.game.countdownRemaining -= 1;
      if (state.game.countdownRemaining <= 0) {
        drawNextBall();
      }
      renderCountdown();
      persistState('countdown_tick', true);
    }, 1000);
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function startElapsedTimer() {
    stopElapsedTimer();
    elapsedTimer = setInterval(() => {
      renderStats();
    }, 1000);
  }

  function stopElapsedTimer() {
    if (elapsedTimer) {
      clearInterval(elapsedTimer);
      elapsedTimer = null;
    }
  }

  function getCurrentInterval() {
    const custom = Number(els.cfgIntervalCustom?.value || 0);
    if (custom >= 3) return custom;
    return Number(els.cfgIntervalPreset?.value || settings.intervalSec || 10);
  }

  function renderAll() {
    renderCurrentBall();
    renderBoard();
    renderHistory();
    renderStats();
    renderCountdown();
    renderControlsState();
    renderPedraList();
  }

  function renderCurrentBall() {
    const c = state.game.currentDraw;
    const p = state.game.previousDraw;
    if (!c) {
      els.currentLetter.textContent = '-';
      els.currentNumber.textContent = '--';
      els.lastDraw.textContent = '--';
    } else {
      els.currentLetter.textContent = getLetterByNumber(c);
      els.currentNumber.textContent = String(c).padStart(2, '0');
      els.lastDraw.textContent = `${getLetterByNumber(c)}-${String(c).padStart(2, '0')}`;
    }
    if (p) {
      els.prevDraw.textContent = `${getLetterByNumber(p)}-${String(p).padStart(2, '0')}`;
    } else {
      els.prevDraw.textContent = '--';
    }

    document.querySelectorAll('.col').forEach((col) => col.classList.remove('active'));
    if (c) {
      const currentLetter = getLetterByNumber(c);
      const col = document.querySelector(`.col[data-letter="${currentLetter}"]`);
      if (col) col.classList.add('active');
    }
  }

  function renderBoard() {
    const drawn = new Set(state.game.drawnNumbers);
    for (let n = 1; n <= 75; n += 1) {
      const el = document.getElementById(`ball-${n}`);
      if (!el) continue;
      el.classList.toggle('drawn', drawn.has(n));
    }
  }

  function clearBoardMarks() {
    for (let n = 1; n <= 75; n += 1) {
      const el = document.getElementById(`ball-${n}`);
      if (el) el.classList.remove('drawn');
    }
    document.querySelectorAll('.col').forEach((col) => col.classList.remove('active'));
  }

  function renderHistory() {
    const all = state.game.drawnNumbers.map((n) => `${getLetterByNumber(n)}-${String(n).padStart(2, '0')}`);
    let list = all;
    if (settings.historyMode === 'last20') list = all.slice(-20);
    if (settings.historyMode === 'last10') list = all.slice(-10);

    els.historyList.innerHTML = '';
    list.forEach((item, idx) => {
      const pill = document.createElement('span');
      pill.className = 'history-pill';
      if (idx === list.length - 1) pill.classList.add('latest');
      pill.textContent = item;
      els.historyList.appendChild(pill);
    });
  }

  function renderStats() {
    const drawn = state.game.drawnNumbers.length;
    const remain = 75 - drawn;
    const pct = Math.round((drawn / 75) * 100);

    els.statDrawn.textContent = String(drawn);
    els.statRemain.textContent = String(remain);
    els.statPct.textContent = `${pct}%`;
    els.progressFill.style.width = `${pct}%`;
    els.statTime.textContent = getElapsedText();
  }

  function renderCountdown() {
    if (!state.game.id) {
      els.countdown.textContent = '--';
      return;
    }
    if (!state.game.autoDraw) {
      els.countdown.textContent = 'Manual';
      return;
    }
    if (state.game.status === 'paused') {
      els.countdown.textContent = 'Pausado';
      return;
    }
    if (state.game.status === 'finished') {
      els.countdown.textContent = 'Finalizado';
      return;
    }
    els.countdown.textContent = `${state.game.countdownRemaining}s`;
  }

  function renderControlsState() {
    const st = state.game.status;
    const hasGame = !!state.game.id;
    els.btnPause.disabled = !(st === 'running');
    els.btnResume.disabled = !(st === 'paused');
    els.btnDraw.disabled = !(hasGame && st !== 'finished' && st !== 'idle');
    els.btnFinish.disabled = !(hasGame && st !== 'finished' && st !== 'idle');
  }

  function getElapsedText() {
    if (!state.game.startedAt) return '00:00';
    const start = new Date(state.game.startedAt).getTime();
    const end = state.game.endedAt ? new Date(state.game.endedAt).getTime() : Date.now();
    const sec = Math.max(0, Math.floor((end - start) / 1000));
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function animateBall() {
    if (!settings.animationsOn) return;
    els.currentBall.style.animationDuration = `${0.8 / settings.animSpeed}s`;
    els.currentBall.classList.remove('anim');
    void els.currentBall.offsetWidth;
    els.currentBall.classList.add('anim');
  }

  function fisherYatesShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function persistState(reason, light = false) {
    state.game.lastActionAt = new Date().toISOString();

    if (!light) {
      const currentStored = safeRead(STORAGE_KEYS.active);
      if (currentStored?.game?.id && currentStored.game.id !== state.game.id) {
        safeWrite(STORAGE_KEYS.backup, currentStored);
      }
      if (settings.autoRecovery && currentStored?.game?.id === state.game.id) {
        safeWrite(STORAGE_KEYS.backup, currentStored);
      }
    }

    safeWrite(STORAGE_KEYS.active, state);
    if (!light) {
      // marcado para depuração de estado
      localStorage.setItem('bingo75.lastReason', reason);
    }
  }

  function archiveCurrentToBackup() {
    const current = safeRead(STORAGE_KEYS.active);
    if (current?.game?.id) {
      safeWrite(STORAGE_KEYS.backup, current);
    }
  }

  function openRecoveryDialog() {
    const candidate = getRecoverCandidate();
    if (!candidate) {
      alert('Nenhum jogo recuperável encontrado.');
      return;
    }

    const g = candidate.game;
    const current = g.currentDraw ? `${getLetterByNumber(g.currentDraw)}-${String(g.currentDraw).padStart(2, '0')}` : '--';
    els.recoverInfo.innerHTML = `
      <p><strong>ID:</strong> ${g.id || '-'}</p>
      <p><strong>Status:</strong> ${g.status}</p>
      <p><strong>Início:</strong> ${formatDate(g.startedAt)}</p>
      <p><strong>Sorteadas:</strong> ${g.drawnNumbers?.length || 0}</p>
      <p><strong>Último número:</strong> ${current}</p>
    `;
    els.recoverDialog.dataset.candidate = JSON.stringify(candidate);
    els.recoverDialog.showModal();
  }

  function restoreCandidateFromDialog() {
    const raw = els.recoverDialog.dataset.candidate;
    if (!raw) return;
    const candidate = JSON.parse(raw);
    state = candidate;
    normalizeRecoveredState();
    persistState('restore_dialog');
    renderAll();
    startElapsedTimer();
    if (state.game.status === 'running' && state.game.autoDraw) startCountdown();
    els.recoverDialog.close();
  }

  function getRecoverCandidate() {
    const candidates = [
      safeRead(STORAGE_KEYS.active),
      safeRead(STORAGE_KEYS.backup),
      safeRead(STORAGE_KEYS.finalized)
    ].filter((x) => x?.game?.id);

    if (!candidates.length) return null;

    candidates.sort((a, b) => {
      const ta = new Date(a.game.lastActionAt || a.game.endedAt || a.game.startedAt || 0).getTime();
      const tb = new Date(b.game.lastActionAt || b.game.endedAt || b.game.startedAt || 0).getTime();
      return tb - ta;
    });

    return candidates[0];
  }

  function toggleSettings(show) {
    els.settingsDrawer.classList.toggle('open', show);
    els.settingsDrawer.setAttribute('aria-hidden', String(!show));
  }

  function hydrateSettingsUI() {
    els.cfgIntervalPreset.value = String(settings.intervalSec);
    els.cfgAuto.checked = settings.autoDraw;
    els.cfgSound.checked = settings.soundOn;
    els.cfgVolume.value = String(settings.volume);
    els.cfgAnim.checked = settings.animationsOn;
    els.cfgAnimSpeed.value = String(settings.animSpeed);
    els.cfgHistoryMode.value = settings.historyMode;
    els.cfgConfirmNew.checked = settings.confirmNewGame;
    els.cfgAutoRecovery.checked = settings.autoRecovery;
    els.cfgTheme.value = settings.theme;
  }

  function saveSettingsFromUI() {
    settings.intervalSec = getCurrentInterval();
    settings.autoDraw = els.cfgAuto.checked;
    settings.soundOn = els.cfgSound.checked;
    settings.volume = Number(els.cfgVolume.value);
    settings.animationsOn = els.cfgAnim.checked;
    settings.animSpeed = Number(els.cfgAnimSpeed.value);
    settings.historyMode = els.cfgHistoryMode.value;
    settings.confirmNewGame = els.cfgConfirmNew.checked;
    settings.autoRecovery = els.cfgAutoRecovery.checked;
    settings.theme = els.cfgTheme.value;

    safeWrite(STORAGE_KEYS.settings, settings);

    state.game.intervalSec = settings.intervalSec;
    state.game.autoDraw = settings.autoDraw;
    if (state.game.countdownRemaining > settings.intervalSec) {
      state.game.countdownRemaining = settings.intervalSec;
    }

    applyTheme(settings.theme);
    persistState('settings');
    renderAll();

    if (state.game.status === 'running') {
      if (state.game.autoDraw) {
        startCountdown();
      } else {
        stopCountdown();
      }
    }

    toggleSettings(false);
  }

  function applyTheme(theme) {
    document.body.classList.remove('theme-midnight', 'theme-graphite');
    if (theme === 'midnight') document.body.classList.add('theme-midnight');
    if (theme === 'graphite') document.body.classList.add('theme-graphite');
  }

  async function toggleTeloMode() {
    if (document.body.classList.contains('telao')) {
      exitTeloMode();
      return;
    }
    document.body.classList.add('telao');
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    } catch (_) {}
    els.btnTelo.textContent = '↩ Sair do Telão';
  }

  async function exitTeloMode() {
    document.body.classList.remove('telao');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch (_) {}
    els.btnTelo.textContent = '🖥️ Modo Telão';
  }

  function openPedraDialog() {
    renderPedraList();
    els.pedraDialog.showModal();
  }

  function addPedraParticipant() {
    const name = (els.pedraNameInput.value || '').trim();
    if (!name) return;
    if (state.pedraMaior.participants.includes(name)) {
      alert('Concorrente já adicionado.');
      return;
    }
    state.pedraMaior.participants.push(name);
    els.pedraNameInput.value = '';
    persistState('pedra_add');
    renderPedraList();
  }

  function renderPedraList() {
    els.pedraList.innerHTML = '';
    state.pedraMaior.participants.forEach((p, idx) => {
      const chip = document.createElement('span');
      chip.className = 'pedra-item';
      chip.innerHTML = `${p} <button data-remove="${idx}" class="btn icon" style="margin-left:6px;background:#5e2d73;">x</button>`;
      els.pedraList.appendChild(chip);
    });

    els.pedraList.querySelectorAll('button[data-remove]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        const i = Number(ev.currentTarget.dataset.remove);
        state.pedraMaior.participants.splice(i, 1);
        persistState('pedra_remove');
        renderPedraList();
      });
    });
  }

  function drawPedraMaior() {
    const participants = state.pedraMaior.participants;
    if (participants.length < 2) {
      alert('Adicione pelo menos 2 concorrentes para realizar a Pedra Maior.');
      return;
    }

    if (state.pedraMaior.lastWinner) {
      const ok = confirm('Já existe um vencedor anterior. Deseja sortear novamente?');
      if (!ok) return;
    }

    const index = Math.floor(Math.random() * participants.length);
    const winner = participants[index];
    state.pedraMaior.lastWinner = winner;
    state.pedraMaior.draws.push({ winner, at: new Date().toISOString(), participants: [...participants] });
    persistState('pedra_draw');
    beep('pedra');

    els.pedraWinner.textContent = `🏆 Vencedor: ${winner}`;
  }

  function resetPedraParticipants() {
    const ok = confirm('Limpar lista de concorrentes da Pedra Maior?');
    if (!ok) return;
    state.pedraMaior.participants = [];
    state.pedraMaior.lastWinner = null;
    els.pedraWinner.textContent = '';
    persistState('pedra_reset');
    renderPedraList();
  }

  function loadSettings() {
    return { ...defaultSettings, ...(safeRead(STORAGE_KEYS.settings) || {}) };
  }

  function safeRead(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      console.warn('Falha ao salvar dados locais:', key);
    }
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR');
  }

  function beep(type) {
    if (!settings.soundOn) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      const tones = {
        start: [420, 0.20],
        spin: [320, 0.07],
        reveal: [660, 0.22],
        pause: [180, 0.12],
        resume: [260, 0.12],
        finish: [140, 0.30],
        pedra: [780, 0.35]
      };
      const [freq, len] = tones[type] || [440, 0.12];

      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.value = settings.volume;

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + len);
      osc.stop(now + len);
    } catch (_) {
      // áudio opcional
    }
  }

  setup();
})();

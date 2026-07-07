(() => {
  const PANEL_ID = "bot2048-panel";
  const DELAY_KEY = "bot2048_delay";
  const EXPERT_KEY = "bot2048_expert";
  const OLD_POWER_KEY = "bot2048_power";

  function clampExpert(n) {
    return Math.min(10, Math.max(1, n));
  }

  function loadExpert() {
    const saved = localStorage.getItem(EXPERT_KEY);
    if (saved != null) return clampExpert(parseInt(saved, 10) || 8);
    const legacy = localStorage.getItem(OLD_POWER_KEY);
    if (legacy != null) return clampExpert([2, 5, 7, 10][parseInt(legacy, 10)] || 8);
    return 8;
  }

  function expertToAi(level) {
    const depth = Math.min(10, 4 + Math.floor(((level - 1) * 6) / 9));
    const timeLimit = Math.round(150 + ((level - 1) * 850) / 9);
    return { depth, timeLimit, level, label: `L${level}` };
  }

  const MIN_DELAY = 0;
  const MAX_DELAY = 2000;

  function clampDelay(ms) {
    return Math.min(MAX_DELAY, Math.max(MIN_DELAY, ms));
  }

  function formatSpeed(ms) {
    if (ms <= 0) return "Instant";
    if (ms < 100) return `${Math.round(ms)}ms`;
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms)}ms`;
  }

  let running = false;
  let delay = clampDelay(parseFloat(localStorage.getItem(DELAY_KEY) || "100") || 100);
  let expert = loadExpert();
  let moves = 0;
  let gameActive = false;
  let watchScheduled = false;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function waitBetweenMoves(ms) {
    if (ms <= 0) {
      await new Promise((r) => requestAnimationFrame(r));
      return;
    }
    await sleep(ms);
  }

  function getGameContext() {
    if (
      document.querySelector(".screen.single") &&
      document.querySelector(".single-container .game-container")
    ) {
      return {
        mode: "Classic",
        tileSelector: ".single-container .tile-container .tile",
        scoreSelector: ".single-container .score-container",
      };
    }
    if (
      document.querySelector(".screen.ingame") &&
      document.querySelector(".container .game-container")
    ) {
      return {
        mode: "Multiplayer",
        tileSelector: ".container .tile-container .tile",
        scoreSelector: "#your_score",
      };
    }
    if (
      document.querySelector(".screen.battleroyale") &&
      document.querySelector(".container .game-container")
    ) {
      return {
        mode: "Battle Royale",
        tileSelector: ".container .tile-container .tile",
        scoreSelector: ".br_your_score p",
      };
    }
    if (
      document.querySelector(".screen.solo") &&
      document.querySelector(".container .game-container")
    ) {
      return {
        mode: "Speedrun",
        tileSelector: ".container .tile-container .tile",
        scoreSelector: "#your_score",
      };
    }
    return null;
  }

  function isGameVisible() {
    return !!getGameContext();
  }

  function readBoardFromManager() {
    const gm = getManager();
    if (!gm?.grid?.cells) return null;

    const grid = new Array(16).fill(0);
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        const tile = gm.grid.cells[x]?.[y];
        if (tile?.value) grid[y * 4 + x] = tile.value;
      }
    }
    return grid.some((v) => v > 0) ? grid : null;
  }

  function readBoardFromDom() {
    const ctx = getGameContext();
    if (!ctx) return null;

    const grid = new Array(16).fill(0);
    const tiles = document.querySelectorAll(ctx.tileSelector);
    if (!tiles.length) return null;

    tiles.forEach((tile) => {
      const m = tile.className.match(/tile-position-(\d)-(\d)/);
      if (!m) return;
      const x = parseInt(m[1], 10) - 1;
      const y = parseInt(m[2], 10) - 1;
      const val = parseInt(tile.querySelector(".tile-inner")?.textContent || "0", 10);
      if (val > 0) grid[y * 4 + x] = val;
    });

    return grid.some((v) => v > 0) ? grid : null;
  }

  function readBoard() {
    return readBoardFromManager() || readBoardFromDom();
  }

  function boardsEqual(a, b) {
    if (!a || !b) return false;
    for (let i = 0; i < 16; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  async function waitForStableBoard(before) {
    for (let i = 0; i < 20; i++) {
      await waitBetweenMoves(i === 0 ? 0 : 16);
      const next = readBoard();
      if (next && (!before || !boardsEqual(before, next))) return next;
    }
    return readBoard();
  }

  function readScore() {
    const ctx = getGameContext();
    if (!ctx) return 0;
    const el = document.querySelector(ctx.scoreSelector);
    return el ? parseInt(el.textContent || "0", 10) || 0 : 0;
  }

  function getManager() {
    return window.__2048GameManager || null;
  }

  function applyMove(dir) {
    const gm = getManager();
    if (!gm || typeof gm.move !== "function") return false;
    gm.move(Board.GAME_DIR[dir]);
    return true;
  }

  function ui() {
    return document.getElementById(PANEL_ID);
  }

  function setStatus(text, mode) {
    const badge = ui()?.querySelector(".badge");
    if (!badge) return;
    badge.textContent = text;
    badge.className = "badge" + (mode ? " " + mode : "");
  }

  function setHint(text) {
    const el = ui()?.querySelector(".hint");
    if (el) el.textContent = text || "";
  }

  function getAiOptions() {
    return expertToAi(expert);
  }

  function formatExpertLabel(opts) {
    return `L${opts.level} · d${opts.depth} · ${opts.timeLimit}ms`;
  }

  function updateStats(lastMove, aiMeta) {
    const panel = ui();
    if (!panel) return;
    panel.querySelector('[data-k="moves"]').textContent = String(moves);
    panel.querySelector('[data-k="score"]').textContent = String(readScore());
    panel.querySelector('[data-k="last"]').textContent = lastMove || "—";
    if (aiMeta && typeof aiMeta === "object") {
      panel.querySelector('[data-k="ai"]').textContent = String(Math.round(aiMeta.score));
      panel.querySelector('[data-k="depth"]').textContent =
        aiMeta.depth ? `d${aiMeta.depth}` : "—";
    } else if (aiMeta != null) {
      panel.querySelector('[data-k="ai"]').textContent = String(Math.round(aiMeta));
    }
    panel.querySelector(".start").disabled = running;
    panel.querySelector(".stop").disabled = !running;
  }

  function positionPanel() {
    const panel = ui();
    const screen = document.querySelector(".screen");
    if (!panel || !screen) return;

    const sr = screen.getBoundingClientRect();
    const gap = 8;
    const panelW = Math.min(300, Math.max(220, sr.width));
    const panelH = panel.offsetHeight || 165;

    panel.style.position = "fixed";
    panel.style.zIndex = "100000";

    if (sr.right + gap + panelW <= window.innerWidth - gap) {
      panel.style.left = `${sr.right + gap}px`;
      panel.style.top = `${sr.top + gap}px`;
      panel.style.width = `${Math.min(panelW, window.innerWidth - sr.right - gap * 2)}px`;
      return;
    }

    if (sr.left >= gap + panelW + gap) {
      panel.style.left = `${gap}px`;
      panel.style.top = `${sr.top + gap}px`;
      panel.style.width = `${Math.min(panelW, sr.left - gap * 2)}px`;
      return;
    }

    if (sr.bottom + gap + panelH <= window.innerHeight - gap) {
      panel.style.left = `${sr.left}px`;
      panel.style.top = `${sr.bottom + gap}px`;
      panel.style.width = `${sr.width}px`;
      return;
    }

    panel.style.left = `${sr.left}px`;
    panel.style.top = `${Math.max(gap, sr.top - panelH - gap)}px`;
    panel.style.width = `${sr.width}px`;
  }

  function setSpeed(nextDelay) {
    delay = clampDelay(Number(nextDelay) || 0);
    localStorage.setItem(DELAY_KEY, String(delay));
    syncPanelControls();
  }

  function setExpert(nextExpert) {
    expert = clampExpert(nextExpert);
    localStorage.setItem(EXPERT_KEY, String(expert));
    syncPanelControls();
  }

  function syncPanelControls() {
    const panel = ui();
    if (!panel) return;
    const speedSlider = panel.querySelector(".speed");
    const speedLabel = panel.querySelector(".speed-val");
    const expertSlider = panel.querySelector(".expert");
    const expertLabel = panel.querySelector(".expert-val");
    const aiOpts = getAiOptions();
    if (speedSlider) speedSlider.value = String(delay);
    if (speedLabel) speedLabel.textContent = formatSpeed(delay);
    if (expertSlider) expertSlider.value = String(expert);
    if (expertLabel) expertLabel.textContent = formatExpertLabel(aiOpts);
  }

  function injectPanel(forceReposition) {
    const existing = document.getElementById(PANEL_ID);
    if (existing && !existing.querySelector(".expert")) {
      if (running) stop();
      existing.remove();
    }
    if (document.getElementById(PANEL_ID)) {
      if (forceReposition) positionPanel();
      return true;
    }

    if (!isGameVisible()) return false;

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    const aiOpts = getAiOptions();
    panel.innerHTML = `
      <div class="row">
        <span class="title">2048 Bot</span>
        <span class="badge">Injected</span>
      </div>
      <div class="stats">
        <div class="stat">Moves<b data-k="moves">0</b></div>
        <div class="stat">Score<b data-k="score">0</b></div>
        <div class="stat">Last<b data-k="last">—</b></div>
        <div class="stat">AI<b data-k="ai">—</b></div>
        <div class="stat">Depth<b data-k="depth">—</b></div>
      </div>
      <div class="ctrl-row">
        <label class="ctrl-label" for="bot2048-speed">Speed</label>
        <input id="bot2048-speed" type="range" class="speed" min="0" max="2000" step="1" value="${delay}" />
        <span class="ctrl-val speed-val">${formatSpeed(delay)}</span>
      </div>
      <div class="ctrl-row">
        <label class="ctrl-label" for="bot2048-expert">Expert</label>
        <input id="bot2048-expert" type="range" class="expert" min="1" max="10" step="1" value="${expert}" />
        <span class="ctrl-val expert-val">${formatExpertLabel(aiOpts)}</span>
      </div>
      <div class="btns">
        <button type="button" class="start">Start Bot</button>
        <button type="button" class="stop" disabled>Stop</button>
      </div>
      <div class="hint">Speed = move delay. Expert = search depth &amp; think time.</div>
    `;

    document.body.appendChild(panel);
    panel.querySelector(".start").addEventListener("click", start);
    panel.querySelector(".stop").addEventListener("click", stop);
    panel.querySelector(".speed").addEventListener("input", (e) => {
      setSpeed(parseFloat(e.target.value));
    });
    panel.querySelector(".expert").addEventListener("input", (e) => {
      setExpert(parseInt(e.target.value, 10));
    });
    positionPanel();
    updateStats();
    return true;
  }

  async function loop() {
    while (running) {
      const ctx = getGameContext();
      if (!ctx) {
        setStatus("No game", "err");
        setHint("Open Classic or Multiplayer to play.");
        await sleep(400);
        continue;
      }

      if (!getManager()) {
        setStatus("Waiting", "");
        setHint("Waiting for game engine...");
        await sleep(300);
        continue;
      }

      const grid = readBoard();
      if (!grid) {
        setHint("Reading board...");
        await sleep(200);
        continue;
      }

      if (getManager().isGameTerminated && getManager().isGameTerminated()) {
        running = false;
        setStatus("Game over", "err");
        setHint("Game ended.");
        updateStats();
        break;
      }

      const gridBefore = readBoard();
      const aiOpts = getAiOptions();
      const aiResult = AI.bestMove(grid, aiOpts);
      if (aiResult.direction == null) {
        for (const d of [3, 2, 1, 0]) {
          const { moved } = Board.move(grid, d);
          if (moved) {
            aiResult.direction = d;
            break;
          }
        }
      }
      if (aiResult.direction == null) {
        running = false;
        setStatus("Stuck", "err");
        setHint("No valid moves.");
        updateStats();
        break;
      }

      if (!applyMove(aiResult.direction)) {
        setStatus("Error", "err");
        setHint("Could not send move to game.");
        await sleep(400);
        continue;
      }

      moves += 1;
      const names = ["left", "up", "right", "down"];
      updateStats(names[aiResult.direction], aiResult);
      setStatus("Running", "on");
      setHint(
        `${ctx.mode} · ${formatSpeed(delay)} speed · ${formatExpertLabel(aiOpts)} · thought ${Math.round(aiResult.ms)}ms`
      );
      await waitBetweenMoves(delay);
      const stable = await waitForStableBoard(gridBefore);
      if (!stable) {
        setHint("Waiting for board update...");
      }
    }
  }

  function start() {
    if (running) return;
    if (!injectPanel()) {
      setHint("Open a game first (Classic or Multiplayer).");
      return;
    }
    if (!readBoard()) {
      setHint("Board not ready yet.");
      return;
    }
    const ctx = getGameContext();
    running = true;
    moves = 0;
    setStatus("Running", "on");
    setHint(ctx ? `${ctx.mode} bot started.` : "");
    updateStats();
    loop();
  }

  function stop() {
    running = false;
    setStatus("Ready", "");
    setHint("Bot stopped.");
    updateStats();
  }

  function removePanel() {
    const panel = ui();
    if (!panel) return;
    if (running) stop();
    panel.remove();
  }

  function syncGamePanel(forceReposition) {
    const visible = isGameVisible();
    if (visible && !gameActive) {
      gameActive = true;
      injectPanel(forceReposition);
      return;
    }
    if (!visible && gameActive) {
      gameActive = false;
      removePanel();
      return;
    }
    if (visible && !ui()) {
      injectPanel(forceReposition);
    }
  }

  function scheduleWatch(forceReposition) {
    if (watchScheduled) return;
    watchScheduled = true;
    requestAnimationFrame(() => {
      watchScheduled = false;
      syncGamePanel(forceReposition);
    });
  }

  function bindScreenObserver() {
    const screen = document.querySelector(".screen");
    if (!screen || screen.dataset.bot2048Observed) return;
    screen.dataset.bot2048Observed = "1";
    const observer = new MutationObserver(() => scheduleWatch(false));
    observer.observe(screen, { attributes: true, attributeFilter: ["class"] });
  }

  window.addEventListener("resize", () => scheduleWatch(true));
  bindScreenObserver();
  syncGamePanel(true);
  setInterval(() => syncGamePanel(false), 3000);

  window.__2048Bot = { start, stop, injectPanel, readBoard };
  console.log("[2048 Bot] loaded");
})();

const AI = (() => {
  const LOG2 = new Uint8Array(131073);
  for (let e = 1, v = 2; v < LOG2.length; v <<= 1, e++) LOG2[v] = e;

  // Prefer big tile in bottom-right; weights from common 2048 solvers.
  const GRID_WEIGHTS = [
    65536, 32768, 16384, 8192,
    512, 1024, 2048, 4096,
    256, 512, 1024, 2048,
    128, 256, 512, 1024,
  ];

  const MOVE_ORDER = [3, 2, 1, 0];
  const tt = new Map();

  let nodes = 0;
  let deadline = 0;

  function hashGrid(g) {
    let h = 2166136261;
    for (let i = 0; i < 16; i++) {
      h ^= g[i];
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function timedOut() {
    return deadline > 0 && performance.now() >= deadline;
  }

  function monotonicity(g) {
    let totals = [0, 0, 0, 0];

    for (let row = 0; row < 4; row++) {
      let cur = 0;
      let nxt = 1;
      while (nxt < 4) {
        while (nxt < 4 && !g[row * 4 + nxt]) nxt++;
        if (nxt >= 4) break;
        while (cur < nxt && !g[row * 4 + cur]) cur++;
        const a = g[row * 4 + cur] ? LOG2[g[row * 4 + cur]] : 0;
        const b = g[row * 4 + nxt] ? LOG2[g[row * 4 + nxt]] : 0;
        if (a > b) totals[0] += b - a;
        else if (b > a) totals[1] += a - b;
        cur = nxt;
        nxt++;
      }
    }

    for (let col = 0; col < 4; col++) {
      let cur = 0;
      let nxt = 1;
      while (nxt < 4) {
        while (nxt < 4 && !g[nxt * 4 + col]) nxt++;
        if (nxt >= 4) break;
        while (cur < nxt && !g[cur * 4 + col]) cur++;
        const a = g[cur * 4 + col] ? LOG2[g[cur * 4 + col]] : 0;
        const b = g[nxt * 4 + col] ? LOG2[g[nxt * 4 + col]] : 0;
        if (a > b) totals[2] += b - a;
        else if (b > a) totals[3] += a - b;
        cur = nxt;
        nxt++;
      }
    }

    return Math.max(totals[0], totals[1]) + Math.max(totals[2], totals[3]);
  }

  function smoothness(g) {
    let smooth = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const a = g[r * 4 + c];
        const b = g[r * 4 + c + 1];
        if (a && b) smooth -= Math.abs(LOG2[a] - LOG2[b]);
      }
    }
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 3; r++) {
        const a = g[r * 4 + c];
        const b = g[(r + 1) * 4 + c];
        if (a && b) smooth -= Math.abs(LOG2[a] - LOG2[b]);
      }
    }
    return smooth;
  }

  function mergePotential(g) {
    let merges = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const a = g[r * 4 + c];
        const b = g[r * 4 + c + 1];
        if (a && a === b) merges += LOG2[a];
      }
    }
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 3; r++) {
        const a = g[r * 4 + c];
        const b = g[(r + 1) * 4 + c];
        if (a && a === b) merges += LOG2[a];
      }
    }
    return merges;
  }

  function weightedGrid(g) {
    let score = 0;
    for (let i = 0; i < 16; i++) {
      const v = g[i];
      if (v) score += LOG2[v] * GRID_WEIGHTS[i];
    }
    return score;
  }

  function evaluate(g) {
    let empty = 0;
    let maxLog = 0;
    for (let i = 0; i < 16; i++) {
      if (!g[i]) empty++;
      else maxLog = Math.max(maxLog, LOG2[g[i]]);
    }

    const mono = monotonicity(g);
    const smooth = smoothness(g);
    const merges = mergePotential(g);
    const gridW = weightedGrid(g);
    const cornerBonus = g[15] && LOG2[g[15]] === maxLog ? maxLog * 512 : 0;

    return (
      empty * 15.0 +
      mono * 5.0 +
      smooth * 0.5 +
      merges * 20.0 +
      gridW * 0.00005 +
      cornerBonus
    );
  }

  function expectimax(g, depth, maxNode) {
    nodes++;
    if (timedOut()) return evaluate(g);

    const key = (hashGrid(g) ^ (depth << 1) ^ (maxNode ? 1 : 0)) >>> 0;
    const cached = tt.get(key);
    if (cached !== undefined) return cached;

    if (!depth || Board.gameOver(g)) {
      const score = evaluate(g);
      tt.set(key, score);
      return score;
    }

    if (maxNode) {
      let best = -Infinity;
      let any = false;
      for (let k = 0; k < 4; k++) {
        const d = MOVE_ORDER[k];
        const { grid, moved } = Board.move(g, d);
        if (!moved) continue;
        any = true;
        best = Math.max(best, expectimax(grid, depth - 1, false));
        if (timedOut()) break;
      }
      const score = any ? best : evaluate(g);
      tt.set(key, score);
      return score;
    }

    const cells = Board.empties(g);
    if (!cells.length) {
      const score = evaluate(g);
      tt.set(key, score);
      return score;
    }

    let total = 0;
    for (const i of cells) {
      g[i] = 2;
      total += 0.9 * expectimax(g, depth - 1, true);
      g[i] = 4;
      total += 0.1 * expectimax(g, depth - 1, true);
      g[i] = 0;
      if (timedOut()) break;
    }
    const score = total / cells.length;
    tt.set(key, score);
    return score;
  }

  function searchRoot(g, depth) {
    let bestDir = null;
    let bestScore = -Infinity;

    for (let k = 0; k < 4; k++) {
      const d = MOVE_ORDER[k];
      const { grid, moved } = Board.move(g, d);
      if (!moved) continue;
      const score = expectimax(grid, depth - 1, false);
      if (score > bestScore) {
        bestScore = score;
        bestDir = d;
      }
      if (timedOut()) break;
    }

    return { direction: bestDir, score: bestScore };
  }

  function bestMove(g, options = {}) {
    const maxDepth = options.depth ?? 6;
    const timeLimit = options.timeLimit ?? 100;
    const start = performance.now();
    deadline = start + timeLimit;

    tt.clear();
    nodes = 0;

    let result = { direction: null, score: -Infinity, depth: 0, nodes: 0, ms: 0 };

    for (let d = 3; d <= maxDepth; d++) {
      const next = searchRoot(g, d);
      if (next.direction != null) {
        result = { ...next, depth: d, nodes, ms: performance.now() - start };
      }
      if (timedOut()) break;
    }

    deadline = 0;
    result.nodes = nodes;
    result.ms = performance.now() - start;
    return result;
  }

  return { bestMove };
})();

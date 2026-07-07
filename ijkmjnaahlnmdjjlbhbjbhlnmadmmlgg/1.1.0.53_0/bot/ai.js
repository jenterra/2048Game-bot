var AI = (() => {
  const CPROB_THRESH = 0.0001;
  const CACHE_DEPTH_LIMIT = 15;
  const DIR_BIAS = [0, 1e-7, 2e-7, 3e-7];

  const tt = new Map();

  let nodes = 0;
  let deadline = 0;
  let depthLimit = 6;
  let curDepth = 0;
  let cacheHits = 0;

  function timedOut() {
    return deadline > 0 && performance.now() >= deadline;
  }

  function boardKey(rows) {
    return rows[0] + "," + rows[1] + "," + rows[2] + "," + rows[3];
  }

  function scoreMoveNode(rows, cprob) {
    nodes++;
    if (cprob < CPROB_THRESH || curDepth >= depthLimit || timedOut()) {
      return Board.heurScoreRows(rows);
    }

    let best = 0;
    curDepth++;
    for (let d = 0; d < 4; d++) {
      const [next, moved] = Board.moveRows(rows, d);
      if (!moved) continue;
      best = Math.max(best, scoreTileChooseNode(next, cprob));
      if (timedOut()) break;
    }
    curDepth--;
    return best;
  }

  function scoreTileChooseNode(rows, cprob) {
    nodes++;
    if (cprob < CPROB_THRESH || curDepth >= depthLimit || timedOut()) {
      return Board.heurScoreRows(rows);
    }

    if (curDepth < CACHE_DEPTH_LIMIT) {
      const cached = tt.get(boardKey(rows));
      if (cached && cached.depth <= curDepth) {
        cacheHits++;
        return cached.score;
      }
    }

    const empties = Board.emptiesFromRows(rows);
    const n = empties.length;
    if (!n) return Board.heurScoreRows(rows);

    const p = cprob / n;
    let total = 0;

    for (let i = 0; i < n; i++) {
      const idx = empties[i];
      total += 0.9 * scoreMoveNode(Board.setRank(rows, idx, 1), p * 0.9);
      if (timedOut()) break;
      total += 0.1 * scoreMoveNode(Board.setRank(rows, idx, 2), p * 0.1);
      if (timedOut()) break;
    }

    const score = total / n;
    if (curDepth < CACHE_DEPTH_LIMIT) {
      tt.set(boardKey(rows), { depth: curDepth, score });
    }
    return score;
  }

  function scoreTopMove(rows, d) {
    const [next, moved] = Board.moveRows(rows, d);
    if (!moved) return -Infinity;
    curDepth = 0;
    return scoreTileChooseNode(next, 1) + DIR_BIAS[d];
  }

  function bestMove(values, options = {}) {
    const maxDepth = options.depth ?? 8;
    const timeLimit = options.timeLimit ?? 200;
    const rows = Board.encodeRows(Board.valuesToRanks(values));

    const start = performance.now();
    deadline = start + timeLimit;
    nodes = 0;
    cacheHits = 0;
    tt.clear();

    const distinct = Board.countDistinctRows(rows);
    const depthCap = Math.max(3, Math.min(maxDepth, distinct - 2));

    let bestDir = null;
    let bestScore = -Infinity;
    let usedDepth = 3;

    for (let limit = 3; limit <= depthCap; limit++) {
      depthLimit = limit;

      let levelDir = null;
      let levelScore = -Infinity;

      for (let d = 0; d < 4; d++) {
        const score = scoreTopMove(rows, d);
        if (score > levelScore) {
          levelScore = score;
          levelDir = d;
        }
      }

      if (levelDir != null) {
        bestDir = levelDir;
        bestScore = levelScore;
        usedDepth = limit;
      }

      if (timedOut()) break;
    }

    deadline = 0;

    if (bestDir == null) {
      for (let d = 3; d >= 0; d--) {
        if (Board.moveRows(rows, d)[1]) {
          bestDir = d;
          break;
        }
      }
    }

    return {
      direction: bestDir,
      score: bestScore,
      depth: usedDepth,
      nodes,
      cacheHits,
      ms: performance.now() - start,
    };
  }

  return { bestMove };
})();

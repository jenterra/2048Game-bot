var Board = (() => {
  const DIRECTIONS = { LEFT: 0, UP: 1, RIGHT: 2, DOWN: 3 };
  const GAME_DIR = { 0: 3, 1: 0, 2: 1, 3: 2 };

  const ROW_MASK = 0xffff;
  const LOST_PENALTY = 200000;
  const EMPTY_W = 270;
  const MERGES_W = 700;
  const MONO_POW = 4;
  const MONO_W = 47;
  const SUM_POW = 3.5;
  const SUM_W = 11;

  const rowLeft = new Uint16Array(65536);
  const rowRight = new Uint16Array(65536);
  const heurRow = new Float64Array(65536);

  function reverseRow(row) {
    return (
      ((row >> 0) & 0xf) << 12 |
      ((row >> 4) & 0xf) << 8 |
      ((row >> 8) & 0xf) << 4 |
      ((row >> 12) & 0xf) << 0
    );
  }

  function slideLine(line) {
    const out = [0, 0, 0, 0];
    let n = 0;
    for (let i = 0; i < 4; i++) if (line[i]) out[n++] = line[i];
    let i = 0;
    const merged = [0, 0, 0, 0];
    let m = 0;
    while (i < n) {
      if (i + 1 < n && out[i] === out[i + 1] && out[i] !== 0) {
        merged[m++] = Math.min(out[i] + 1, 15);
        i += 2;
      } else {
        merged[m++] = out[i++];
      }
    }
    return merged;
  }

  function initTables() {
    for (let row = 0; row < 65536; row++) {
      const line = [
        (row >> 0) & 0xf,
        (row >> 4) & 0xf,
        (row >> 8) & 0xf,
        (row >> 12) & 0xf,
      ];

      let sum = 0;
      let empty = 0;
      let merges = 0;
      let prev = 0;
      let counter = 0;
      for (let i = 0; i < 4; i++) {
        const rank = line[i];
        sum += Math.pow(rank, SUM_POW);
        if (!rank) empty++;
        else {
          if (prev === rank) counter++;
          else if (counter > 0) {
            merges += 1 + counter;
            counter = 0;
          }
          prev = rank;
        }
      }
      if (counter > 0) merges += 1 + counter;

      let monoL = 0;
      let monoR = 0;
      for (let i = 1; i < 4; i++) {
        if (line[i - 1] > line[i]) {
          monoL += Math.pow(line[i - 1], MONO_POW) - Math.pow(line[i], MONO_POW);
        } else {
          monoR += Math.pow(line[i], MONO_POW) - Math.pow(line[i - 1], MONO_POW);
        }
      }

      heurRow[row] =
        LOST_PENALTY +
        EMPTY_W * empty +
        MERGES_W * merges -
        MONO_W * Math.min(monoL, monoR) -
        SUM_W * sum;

      const moved = slideLine(line.slice());
      const result =
        (moved[0] << 0) | (moved[1] << 4) | (moved[2] << 8) | (moved[3] << 12);
      const revRow = reverseRow(row);
      const revResult = reverseRow(result);

      rowLeft[row] = (row ^ result) & ROW_MASK;
      rowRight[revRow] = (revRow ^ revResult) & ROW_MASK;
    }
  }

  initTables();

  function encodeRows(ranks) {
    return [
      ranks[0] | (ranks[1] << 4) | (ranks[2] << 8) | (ranks[3] << 12),
      ranks[4] | (ranks[5] << 4) | (ranks[6] << 8) | (ranks[7] << 12),
      ranks[8] | (ranks[9] << 4) | (ranks[10] << 8) | (ranks[11] << 12),
      ranks[12] | (ranks[13] << 4) | (ranks[14] << 8) | (ranks[15] << 12),
    ];
  }

  function decodeRows(rows, out) {
    for (let r = 0; r < 4; r++) {
      const row = rows[r];
      out[r * 4] = row & 0xf;
      out[r * 4 + 1] = (row >> 4) & 0xf;
      out[r * 4 + 2] = (row >> 8) & 0xf;
      out[r * 4 + 3] = (row >> 12) & 0xf;
    }
  }

  function transposeRows(rows) {
    return [
      (rows[0] & 0xf) | ((rows[1] & 0xf) << 4) | ((rows[2] & 0xf) << 8) | ((rows[3] & 0xf) << 12),
      ((rows[0] >> 4) & 0xf) | ((rows[1] >> 4) & 0xf) << 4 | ((rows[2] >> 4) & 0xf) << 8 | ((rows[3] >> 4) & 0xf) << 12,
      ((rows[0] >> 8) & 0xf) | ((rows[1] >> 8) & 0xf) << 4 | ((rows[2] >> 8) & 0xf) << 8 | ((rows[3] >> 8) & 0xf) << 12,
      ((rows[0] >> 12) & 0xf) | ((rows[1] >> 12) & 0xf) << 4 | ((rows[2] >> 12) & 0xf) << 8 | ((rows[3] >> 12) & 0xf) << 12,
    ];
  }

  function valuesToRanks(values) {
    const ranks = new Uint8Array(16);
    for (let i = 0; i < 16; i++) ranks[i] = values[i] ? Math.round(Math.log2(values[i])) : 0;
    return ranks;
  }

  function ranksToValues(ranks) {
    const values = new Array(16);
    for (let i = 0; i < 16; i++) values[i] = ranks[i] ? 1 << ranks[i] : 0;
    return values;
  }

  function moveRows(rows, dir) {
    let next;
    switch (dir) {
      case DIRECTIONS.LEFT:
        next = [
          (rows[0] ^ rowLeft[rows[0]]) & ROW_MASK,
          (rows[1] ^ rowLeft[rows[1]]) & ROW_MASK,
          (rows[2] ^ rowLeft[rows[2]]) & ROW_MASK,
          (rows[3] ^ rowLeft[rows[3]]) & ROW_MASK,
        ];
        break;
      case DIRECTIONS.RIGHT:
        next = [
          (rows[0] ^ rowRight[rows[0]]) & ROW_MASK,
          (rows[1] ^ rowRight[rows[1]]) & ROW_MASK,
          (rows[2] ^ rowRight[rows[2]]) & ROW_MASK,
          (rows[3] ^ rowRight[rows[3]]) & ROW_MASK,
        ];
        break;
      case DIRECTIONS.UP: {
        const t = transposeRows(rows);
        const moved = [
          (t[0] ^ rowLeft[t[0]]) & ROW_MASK,
          (t[1] ^ rowLeft[t[1]]) & ROW_MASK,
          (t[2] ^ rowLeft[t[2]]) & ROW_MASK,
          (t[3] ^ rowLeft[t[3]]) & ROW_MASK,
        ];
        next = transposeRows(moved);
        break;
      }
      case DIRECTIONS.DOWN: {
        const t = transposeRows(rows);
        const moved = [
          (t[0] ^ rowRight[t[0]]) & ROW_MASK,
          (t[1] ^ rowRight[t[1]]) & ROW_MASK,
          (t[2] ^ rowRight[t[2]]) & ROW_MASK,
          (t[3] ^ rowRight[t[3]]) & ROW_MASK,
        ];
        next = transposeRows(moved);
        break;
      }
      default:
        next = rows.slice();
    }
    const moved =
      rows[0] !== next[0] ||
      rows[1] !== next[1] ||
      rows[2] !== next[2] ||
      rows[3] !== next[3];
    return [next, moved];
  }

  function heurScoreRows(rows) {
    return (
      heurRow[rows[0]] +
      heurRow[rows[1]] +
      heurRow[rows[2]] +
      heurRow[rows[3]] +
      heurRow[
        (rows[0] & 0xf) |
          ((rows[1] & 0xf) << 4) |
          ((rows[2] & 0xf) << 8) |
          ((rows[3] & 0xf) << 12)
      ] +
      heurRow[
        ((rows[0] >> 4) & 0xf) |
          (((rows[1] >> 4) & 0xf) << 4) |
          (((rows[2] >> 4) & 0xf) << 8) |
          (((rows[3] >> 4) & 0xf) << 12)
      ] +
      heurRow[
        ((rows[0] >> 8) & 0xf) |
          (((rows[1] >> 8) & 0xf) << 4) |
          (((rows[2] >> 8) & 0xf) << 8) |
          (((rows[3] >> 8) & 0xf) << 12)
      ] +
      heurRow[
        ((rows[0] >> 12) & 0xf) |
          (((rows[1] >> 12) & 0xf) << 4) |
          (((rows[2] >> 12) & 0xf) << 8) |
          (((rows[3] >> 12) & 0xf) << 12)
      ]
    );
  }

  function countEmptyRows(rows) {
    let n = 0;
    for (let r = 0; r < 4; r++) {
      const row = rows[r];
      if ((row & 0xf) === 0) n++;
      if (((row >> 4) & 0xf) === 0) n++;
      if (((row >> 8) & 0xf) === 0) n++;
      if (((row >> 12) & 0xf) === 0) n++;
    }
    return n;
  }

  function countDistinctRows(rows) {
    let bits = 0;
    for (let r = 0; r < 4; r++) {
      let row = rows[r];
      for (let i = 0; i < 4; i++) {
        const rank = row & 0xf;
        if (rank) bits |= 1 << rank;
        row >>= 4;
      }
    }
    bits >>= 1;
    let count = 0;
    while (bits) {
      bits &= bits - 1;
      count++;
    }
    return count;
  }

  function emptiesFromRows(rows) {
    const cells = [];
    for (let r = 0; r < 4; r++) {
      let row = rows[r];
      for (let c = 0; c < 4; c++) {
        if ((row & 0xf) === 0) cells.push(r * 4 + c);
        row >>= 4;
      }
    }
    return cells;
  }

  function setRank(rows, idx, rank) {
    const r = idx >> 2;
    const shift = (idx & 3) << 2;
    const mask = 0xf << shift;
    const next = rows.slice();
    next[r] = (rows[r] & ~mask) | (rank << shift);
    return next;
  }

  function canMoveRows(rows) {
    for (let d = 0; d < 4; d++) {
      if (moveRows(rows, d)[1]) return true;
    }
    return false;
  }

  function gameOverRows(rows) {
    return countEmptyRows(rows) === 0 && !canMoveRows(rows);
  }

  function move(values, dir) {
    const rows = encodeRows(valuesToRanks(values));
    const [nextRows, moved] = moveRows(rows, dir);
    const out = new Uint8Array(16);
    decodeRows(nextRows, out);
    return { grid: ranksToValues(out), moved, rows: nextRows };
  }

  function empties(values) {
    const cells = [];
    for (let i = 0; i < 16; i++) if (!values[i]) cells.push(i);
    return cells;
  }

  function gameOver(values) {
    return gameOverRows(encodeRows(valuesToRanks(values)));
  }

  return {
    DIRECTIONS,
    GAME_DIR,
    move,
    empties,
    gameOver,
    valuesToRanks,
    encodeRows,
    decodeRows,
    moveRows,
    heurScoreRows,
    countEmptyRows,
    countDistinctRows,
    emptiesFromRows,
    setRank,
    gameOverRows,
    canMoveRows,
  };
})();

const Board = (() => {
  const DIRECTIONS = { LEFT: 0, UP: 1, RIGHT: 2, DOWN: 3 };
  const GAME_DIR = { 0: 3, 1: 0, 2: 1, 3: 2 };

  function slide(line) {
    const tiles = line.filter((v) => v !== 0);
    const out = [];
    let i = 0;
    while (i < tiles.length) {
      if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
        out.push(tiles[i] * 2);
        i += 2;
      } else out.push(tiles[i++]);
    }
    while (out.length < 4) out.push(0);
    return out;
  }

  function moveLeft(g) {
    const r = g.slice();
    let moved = false;
    for (let row = 0; row < 4; row++) {
      const line = [g[row * 4], g[row * 4 + 1], g[row * 4 + 2], g[row * 4 + 3]];
      const next = slide(line);
      for (let c = 0; c < 4; c++) {
        if (r[row * 4 + c] !== next[c]) moved = true;
        r[row * 4 + c] = next[c];
      }
    }
    return { grid: r, moved };
  }

  function moveRight(g) {
    const r = g.slice();
    let moved = false;
    for (let row = 0; row < 4; row++) {
      const line = [g[row * 4 + 3], g[row * 4 + 2], g[row * 4 + 1], g[row * 4]];
      const next = slide(line);
      for (let c = 0; c < 4; c++) {
        const v = next[c];
        const idx = row * 4 + (3 - c);
        if (r[idx] !== v) moved = true;
        r[idx] = v;
      }
    }
    return { grid: r, moved };
  }

  function moveUp(g) {
    const r = g.slice();
    let moved = false;
    for (let c = 0; c < 4; c++) {
      const line = [g[c], g[4 + c], g[8 + c], g[12 + c]];
      const next = slide(line);
      for (let row = 0; row < 4; row++) {
        const idx = row * 4 + c;
        if (r[idx] !== next[row]) moved = true;
        r[idx] = next[row];
      }
    }
    return { grid: r, moved };
  }

  function moveDown(g) {
    const r = g.slice();
    let moved = false;
    for (let c = 0; c < 4; c++) {
      const line = [g[12 + c], g[8 + c], g[4 + c], g[c]];
      const next = slide(line);
      for (let row = 0; row < 4; row++) {
        const idx = (3 - row) * 4 + c;
        if (r[idx] !== next[row]) moved = true;
        r[idx] = next[row];
      }
    }
    return { grid: r, moved };
  }

  function move(g, dir) {
    switch (dir) {
      case DIRECTIONS.LEFT:
        return moveLeft(g);
      case DIRECTIONS.UP:
        return moveUp(g);
      case DIRECTIONS.RIGHT:
        return moveRight(g);
      case DIRECTIONS.DOWN:
        return moveDown(g);
      default:
        return { grid: g.slice(), moved: false };
    }
  }

  function empties(g) {
    const a = [];
    for (let i = 0; i < 16; i++) if (!g[i]) a.push(i);
    return a;
  }

  function gameOver(g) {
    if (empties(g).length) return false;
    for (let i = 0; i < 16; i++) {
      const v = g[i];
      if (i % 4 < 3 && v === g[i + 1]) return false;
      if (i < 12 && v === g[i + 4]) return false;
    }
    return true;
  }

  return { DIRECTIONS, GAME_DIR, move, empties, gameOver };
})();

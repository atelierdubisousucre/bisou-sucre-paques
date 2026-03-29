export function isSolved(tiles: number[]): boolean {
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] !== i) return false;
  }
  return true;
}

export function shuffleFromSolved(n: number, moves: number = 300): number[] {
  const tiles = Array.from({ length: n * n }, (_, i) => i);
  let emptyPos = n * n - 1;
  for (let i = 0; i < moves; i++) {
    const row = Math.floor(emptyPos / n);
    const col = emptyPos % n;
    const neighbors: number[] = [];
    if (row > 0) neighbors.push(emptyPos - n);
    if (row < n - 1) neighbors.push(emptyPos + n);
    if (col > 0) neighbors.push(emptyPos - 1);
    if (col < n - 1) neighbors.push(emptyPos + 1);
    const swapPos = neighbors[Math.floor(Math.random() * neighbors.length)];
    [tiles[emptyPos], tiles[swapPos]] = [tiles[swapPos], tiles[emptyPos]];
    emptyPos = swapPos;
  }
  return tiles;
}

export function applyMove(tiles: number[], pos: number, n: number): number[] | null {
  const ePos = tiles.indexOf(n * n - 1);
  const r = Math.floor(pos / n), c = pos % n;
  const er = Math.floor(ePos / n), ec = ePos % n;
  const ok = (Math.abs(r - er) === 1 && c === ec) || (Math.abs(c - ec) === 1 && r === er);
  if (!ok) return null;
  const next = [...tiles];
  [next[ePos], next[pos]] = [next[pos], next[ePos]];
  return next;
}

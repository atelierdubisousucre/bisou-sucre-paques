export function generateSolvedTiles(n: number): number[] {
  return Array.from({ length: n * n }, (_, i) => i);
}

export function isSolved(tiles: number[]): boolean {
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] !== i) return false;
  }
  return true;
}

export function shuffleFromSolved(n: number, moves: number = 300): number[] {
  const tiles = generateSolvedTiles(n);
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

export function applyMove(tiles: number[], tilePos: number, n: number): number[] | null {
  const emptyPos = tiles.indexOf(tiles.length - 1);
  const rowA = Math.floor(tilePos / n), colA = tilePos % n;
  const rowB = Math.floor(emptyPos / n), colB = emptyPos % n;
  const adjacent = (Math.abs(rowA - rowB) === 1 && colA === colB) ||
                   (Math.abs(colA - colB) === 1 && rowA === rowB);
  if (!adjacent) return null;
  const newTiles = [...tiles];
  [newTiles[emptyPos], newTiles[tilePos]] = [newTiles[tilePos], newTiles[emptyPos]];
  return newTiles;
}

/**
 * Generates a solved tile array: [0, 1, 2, ..., n*n-1]
 * Last tile (n*n-1) is the empty slot.
 */
export function generateSolvedTiles(n: number): number[] {
  return Array.from({ length: n * n }, (_, i) => i);
}

/**
 * Checks if the puzzle is solved:
 * tiles[i] === i for all i.
 */
export function isSolved(tiles: number[]): boolean {
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] !== i) return false;
  }
  return true;
}

/**
 * Shuffles by performing random valid moves from the solved state.
 * This guarantees the puzzle is ALWAYS solvable.
 * @param n Grid size (3, 4, or 5)
 * @param moves Number of random moves (more = more shuffled)
 */
export function shuffleFromSolved(n: number, moves: number = 300): number[] {
  const tiles = generateSolvedTiles(n);
  let emptyPos = n * n - 1; // Empty tile starts at bottom-right

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

/**
 * Returns the index of the empty tile (value = n*n-1) in the tiles array.
 */
export function findEmptyPosition(tiles: number[]): number {
  return tiles.indexOf(tiles.length - 1);
}

/**
 * Checks if two grid positions are adjacent (horizontally or vertically).
 */
export function areAdjacent(posA: number, posB: number, n: number): boolean {
  const rowA = Math.floor(posA / n);
  const colA = posA % n;
  const rowB = Math.floor(posB / n);
  const colB = posB % n;
  return (
    (Math.abs(rowA - rowB) === 1 && colA === colB) ||
    (Math.abs(colA - colB) === 1 && rowA === rowB)
  );
}

/**
 * Applies a move: swaps tile at `tilePos` with the empty tile.
 * Returns a new tiles array. Returns null if move is invalid.
 */
export function applyMove(
  tiles: number[],
  tilePos: number,
  n: number
): number[] | null {
  const emptyPos = findEmptyPosition(tiles);
  if (!areAdjacent(tilePos, emptyPos, n)) return null;

  const newTiles = [...tiles];
  [newTiles[emptyPos], newTiles[tilePos]] = [newTiles[tilePos], newTiles[emptyPos]];
  return newTiles;
}

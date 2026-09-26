// Static enemy movement graph and BFS (GDD 5.2, 5.3). Pure functions, no DOM access.

import { COLS, ROWS, LADDER } from './level.js';

export const UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3;

export function nodeIndex(col, row) { return row * COLS + col; }
export function nodeCol(index) { return index % COLS; }
export function nodeRow(index) { return (index / COLS) | 0; }

// Builds the static graph. A node is a passable tile with support (GDD 5.2).
// There are no falling edges, so enemies never drop through holes or pipe ends.
export function buildGraph(level) {
  const size = COLS * ROWS;
  const isNode = new Uint8Array(size);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (level.isPassable(c, r) && level.hasSupport(c, r)) isNode[nodeIndex(c, r)] = 1;
    }
  }

  // Neighbour slots are stored in the fixed order UP, DOWN, LEFT, RIGHT.
  const neighbors = new Int16Array(size * 4).fill(-1);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = nodeIndex(c, r);
      if (!isNode[i]) continue;
      const base = i * 4;

      // Vertical edge (c,r) <-> (c,r-1): only from inside a ladder tile.
      if (level.tile(c, r) === LADDER && level.isPassable(c, r - 1) && isNode[nodeIndex(c, r - 1)]) {
        neighbors[base + UP] = nodeIndex(c, r - 1);
      }
      // Same edge seen from below: the tile under us is a ladder.
      if (level.tile(c, r + 1) === LADDER && isNode[nodeIndex(c, r + 1)]) {
        neighbors[base + DOWN] = nodeIndex(c, r + 1);
      }
      if (c > 0 && isNode[nodeIndex(c - 1, r)]) neighbors[base + LEFT] = nodeIndex(c - 1, r);
      if (c < COLS - 1 && isNode[nodeIndex(c + 1, r)]) neighbors[base + RIGHT] = nodeIndex(c + 1, r);
    }
  }

  return { size, isNode, neighbors };
}

// Restricts the shared graph to what one enemy type may use (LEVEL3.md 6.2).
// A node survives only if level.floorOf(row) is in `floors` (null = all floors).
// An edge survives only if both ends survive and, for climbs === false, only if
// it is horizontal. The result has the same shape as buildGraph's, so every AI
// decision made on it simply cannot name a forbidden tile.
export function restrictGraph(graph, level, { floors = null, climbs = true } = {}) {
  const allowed = floors === null ? null : new Set(floors);
  const isNode = new Uint8Array(graph.size);
  for (let i = 0; i < graph.size; i++) {
    if (!graph.isNode[i]) continue;
    if (allowed && !allowed.has(level.floorOf(nodeRow(i)))) continue;
    isNode[i] = 1;
  }
  const neighbors = new Int16Array(graph.size * 4).fill(-1);
  for (let i = 0; i < graph.size; i++) {
    if (!isNode[i]) continue;
    for (let d = 0; d < 4; d++) {
      if (!climbs && (d === UP || d === DOWN)) continue;
      const n = graph.neighbors[i * 4 + d];
      if (n >= 0 && isNode[n]) neighbors[i * 4 + d] = n;
    }
  }
  return { size: graph.size, isNode, neighbors };
}

export function isGraphNode(graph, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  return graph.isNode[nodeIndex(col, row)] === 1;
}

// Breadth-first search expanding neighbours in the fixed order UP, DOWN, LEFT, RIGHT.
export function bfs(graph, start) {
  const dist = new Int16Array(graph.size).fill(-1);
  const parent = new Int16Array(graph.size).fill(-1);
  if (!graph.isNode[start]) return { dist, parent };

  const queue = new Int16Array(graph.size);
  let head = 0, tail = 0;
  dist[start] = 0;
  queue[tail++] = start;

  while (head < tail) {
    const cur = queue[head++];
    const base = cur * 4;
    for (let d = 0; d < 4; d++) {
      const next = graph.neighbors[base + d];
      if (next < 0 || dist[next] >= 0) continue;
      dist[next] = dist[cur] + 1;
      parent[next] = cur;
      queue[tail++] = next;
    }
  }
  return { dist, parent };
}

// First node on the path start -> goal, or -1 when there is no path.
export function firstStepTo(dist, parent, start, goal) {
  if (goal < 0 || goal === start || dist[goal] < 0) return -1;
  let cur = goal;
  while (parent[cur] !== start) {
    cur = parent[cur];
    if (cur < 0) return -1;
  }
  return cur;
}

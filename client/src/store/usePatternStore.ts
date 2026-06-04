import { create } from 'zustand';
import { Pattern, Color, Palette } from '../types';
import { PALETTES } from '../constants/palettes';

export type Tool = 'move' | 'paint' | 'erase' | 'fill' | 'pick';

/** Result shape for fillArea — lets the caller decide how to warn the user. */
export type FillResult =
  | { ok: true; count: number }
  | { ok: false; reason: 'no-pattern' | 'same-color' | 'unenclosed'; count?: number };

interface PatternState {
  pattern: Pattern | null;
  selectedColor: Color | null;
  currentPalette: Palette;
  history: Pattern[];
  historyIndex: number;
  zoom: number;
  activeTool: Tool;

  setPattern: (pattern: Pattern) => void;
  updateCell: (x: number, y: number, colorId: string | null) => void;
  setSelectedColor: (color: Color | null) => void;
  setPalette: (paletteId: string) => void;
  fillArea: (x: number, y: number) => FillResult;
  clearGrid: () => void;
  setZoom: (zoom: number) => void;
  setTool: (tool: Tool) => void;
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
}

export const usePatternStore = create<PatternState>((set, get) => ({
  pattern: null,
  selectedColor: PALETTES[0].colors[0],
  currentPalette: PALETTES[0],
  history: [],
  historyIndex: -1,
  zoom: 1,
  activeTool: 'move',

  setPattern: (pattern) => {
    set({
      pattern,
      history: [pattern],
      historyIndex: 0,
      activeTool: 'move',
    });
  },

  updateCell: (x: number, y: number, colorId: string | null) => {
    const { pattern } = get();
    if (!pattern) return;
    const newGrid = [...pattern.grid];
    newGrid[y] = [...newGrid[y]];
    newGrid[y][x] = { ...newGrid[y][x], colorId };
    set({ pattern: { ...pattern, grid: newGrid } });
  },

  setSelectedColor: (color) => set({ selectedColor: color }),

  setPalette: (paletteId) => {
    const palette = PALETTES.find((p) => p.id === paletteId) || PALETTES[0];
    set({ currentPalette: palette });
  },

  /**
   * Paint-bucket fill starting at (x,y).
   * Flood-fills 4-connected cells sharing the target colorId. Refuses when
   * the region touches the grid boundary — that signals an unenclosed area
   * (the "whole background") and would pollute the canvas.
   */
  fillArea: (x, y): FillResult => {
    const { pattern, selectedColor } = get();
    if (!pattern) return { ok: false, reason: 'no-pattern' };

    const target = pattern.grid[y][x].colorId;
    const newColorId = selectedColor?.id ?? null;
    if (target === newColorId) return { ok: false, reason: 'same-color' };

    const W = pattern.width;
    const H = pattern.height;
    const visited: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false));
    const region: [number, number][] = [];
    const stack: [number, number][] = [[x, y]];
    let touchesEdge = false;

    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
      if (visited[cy][cx]) continue;
      if (pattern.grid[cy][cx].colorId !== target) continue;
      visited[cy][cx] = true;
      region.push([cx, cy]);
      if (cx === 0 || cx === W - 1 || cy === 0 || cy === H - 1) touchesEdge = true;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }

    // Unenclosed guard: region reaches boundary AND is big → likely "fill
    // the whole background" accident. Block and let UI show a toast.
    if (touchesEdge && region.length > W * H * 0.2) {
      return { ok: false, reason: 'unenclosed', count: region.length };
    }

    const newGrid = pattern.grid.map((r) => r.map((c) => ({ ...c })));
    for (const [fx, fy] of region) newGrid[fy][fx].colorId = newColorId;
    set({ pattern: { ...pattern, grid: newGrid } });
    get().saveToHistory();
    return { ok: true, count: region.length };
  },

  clearGrid: () => {
    const { pattern } = get();
    if (!pattern) return;
    const empty = Array.from({ length: pattern.height }, () =>
      Array.from({ length: pattern.width }, () => ({ colorId: null })),
    );
    set({ pattern: { ...pattern, grid: empty } });
    get().saveToHistory();
  },

  setZoom: (zoom) => {
    if (!isNaN(zoom)) set({ zoom });
  },
  setTool: (tool) => set({ activeTool: tool }),

  saveToHistory: () => {
    const { pattern, history, historyIndex } = get();
    if (!pattern) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(pattern)));
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) set({ pattern: history[historyIndex - 1], historyIndex: historyIndex - 1 });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      set({ pattern: history[historyIndex + 1], historyIndex: historyIndex + 1 });
    }
  },
}));

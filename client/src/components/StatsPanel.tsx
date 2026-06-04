import React from 'react';
import { usePatternStore } from '../store/usePatternStore';

export const StatsPanel: React.FC = () => {
  const { pattern, currentPalette } = usePatternStore();

  if (!pattern) return null;

  const counts: Record<string, number> = {};
  pattern.grid.forEach((row) => {
    row.forEach((cell) => {
      if (cell.colorId) {
        counts[cell.colorId] = (counts[cell.colorId] || 0) + 1;
      }
    });
  });

  const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const totalBeads = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-4 p-6 bg-paper-warm border-t-[2px] border-ink/20 h-64 overflow-y-auto">
      <div className="flex justify-between items-center">
        <h3 className="font-body font-extrabold text-ink text-sm uppercase tracking-[0.08em]">
          Material Statistics
        </h3>
        <span className="fsy-tag">Total {totalBeads}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {sortedCounts.map(([colorId, count]) => {
          const color = currentPalette.colors.find((c) => c.id === colorId);
          if (!color) return null;
          return (
            <div
              key={colorId}
              className="flex items-center gap-3 p-3 bg-paper rounded-[12px] border border-ink/25"
            >
              <div
                className="fsy-bead w-8 h-8 border-[2px] border-ink flex-shrink-0"
                style={{
                  backgroundColor: color.hex,
                  boxShadow: 'inset 1.5px 1.5px 0 rgba(255,255,255,0.55)',
                }}
              />
              <div className="flex flex-col overflow-hidden">
                <span className="font-body font-bold text-ink text-[10px] truncate">{color.name}</span>
                <span className="font-pixel-mono text-ink text-lg leading-none">{count}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

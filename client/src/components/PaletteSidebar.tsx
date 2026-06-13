import React, { useMemo, useState } from 'react';
import { usePatternStore } from '../store/usePatternStore';
import { Hand, Paintbrush, PaintBucket, Eraser, Pipette, Search, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { codeTextColor } from '../utils/colorUtils';

interface PaletteSidebarProps {
  /** Drawer-open state on mobile. Ignored on desktop (lg+) via CSS override. */
  isOpen?: boolean;
  onClose?: () => void;
}

const TOOLS = [
  { name: 'move' as const, icon: Hand, title: 'Move (Space + Drag)' },
  { name: 'paint' as const, icon: Paintbrush, title: 'Paint (B)' },
  { name: 'fill' as const, icon: PaintBucket, title: 'Fill (G)' },
  { name: 'pick' as const, icon: Pipette, title: 'Pick colour from canvas (I)' },
  { name: 'erase' as const, icon: Eraser, title: 'Erase (E)' },
];

/**
 * Right sidebar — everything about ACTIVE drawing: tools, the colour you're
 * holding, the 221-colour chart (family-filtered + searchable, mirroring the
 * official colour-chart layout), and live material usage.
 */
export const PaletteSidebar: React.FC<PaletteSidebarProps> = ({ isOpen = false, onClose }) => {
  const {
    pattern,
    currentPalette,
    selectedColor,
    setSelectedColor,
    activeTool,
    setTool,
  } = usePatternStore();

  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<string>('all');

  // Family letters present in the palette, in chart order (A…H, M).
  const families = useMemo(() => {
    const seen = new Set<string>();
    currentPalette.colors.forEach((c) => seen.add((c.code ?? c.id).charAt(0)));
    return [...seen];
  }, [currentPalette]);

  const filteredColors = useMemo(() => {
    const q = query.trim().toLowerCase();
    return currentPalette.colors.filter((c) => {
      const code = (c.code ?? c.id).toLowerCase();
      if (family !== 'all' && !code.startsWith(family.toLowerCase())) return false;
      if (!q) return true;
      return code.includes(q) || c.name.toLowerCase().includes(q) || c.hex.toLowerCase().includes(q);
    });
  }, [currentPalette, family, query]);

  const handleColorSelect = (color: (typeof currentPalette.colors)[number] | null) => {
    setSelectedColor(color);
    // Picking a colour auto-engages paint. Eraser when explicitly null.
    setTool(color ? 'paint' : 'erase');
    // Close the mobile drawer so the user returns straight to the canvas.
    onClose?.();
  };

  const counts: Record<string, number> = {};
  if (pattern) {
    pattern.grid.forEach((row) => {
      row.forEach((cell) => {
        if (cell.colorId) counts[cell.colorId] = (counts[cell.colorId] || 0) + 1;
      });
    });
  }
  const totalBeads = Object.values(counts).reduce((a, b) => a + b, 0);
  const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <div
      className={cn(
        'flex flex-col gap-4 bg-paper-warm overflow-y-auto relative',
        // Mobile: bottom drawer
        'fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] rounded-t-[24px] border-t-[3px] border-ink p-5 pt-3',
        'transition-transform duration-[220ms] ease-out',
        isOpen ? 'translate-y-0' : 'translate-y-full',
        // Desktop: static sidebar, ignores isOpen
        'lg:static lg:z-auto lg:w-80 lg:max-h-none lg:translate-y-0 lg:transition-none lg:shrink-0',
        'lg:rounded-none lg:border-t-0 lg:border-l-[2px] lg:border-ink/20 lg:pt-5',
      )}
    >
      {/* Mobile drawer header — hidden on desktop */}
      <div className="lg:hidden flex items-center justify-between -mx-1">
        <h2 className="font-cute font-bold text-ink text-lg">Colours</h2>
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 flex items-center justify-center rounded-full text-ink-hint hover:text-ink hover:bg-butter/60"
          aria-label="Close palette"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tools — desktop only. Mobile uses the floating side rail instead. */}
      <div className="hidden lg:flex lg:flex-col lg:gap-2">
        <h3 className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em]">Tools</h3>
        <div className="flex gap-1 p-1 bg-paper rounded-[12px] border border-ink/20">
          {TOOLS.map(({ name, icon: Icon, title }) => (
            <button
              key={name}
              onClick={() => setTool(name)}
              className={cn(
                'flex-1 flex items-center justify-center p-2.5 rounded-[8px] transition-all min-h-[36px]',
                activeTool === name
                  ? 'bg-butter text-ink border border-ink/30'
                  : 'text-ink-hint hover:text-ink hover:bg-butter/40 border border-transparent',
              )}
              title={title}
              aria-label={title}
            >
              <Icon className={cn('w-4 h-4', name === 'fill' && '-scale-x-100')} />
            </button>
          ))}
        </div>
        <p className="font-body text-ink-hint text-[10px] italic">Tip: right-click any bead to pick its colour as the brush.</p>
      </div>

      {/* Active Color — soft card with the bead as the focal point */}
      <div className="flex items-center gap-3 p-3 bg-paper rounded-[14px] border border-ink/20">
        <div
          className="fsy-bead w-12 h-12 border-[2px] border-ink shrink-0 flex items-center justify-center"
          style={{
            backgroundColor: selectedColor?.hex || 'transparent',
            boxShadow: 'inset 1.5px 1.5px 0 rgba(255,255,255,0.55)',
          }}
        >
          {selectedColor && (
            <span
              className="font-pixel-mono text-xs leading-none"
              style={{ color: codeTextColor(selectedColor.hex) }}
            >
              {selectedColor.code}
            </span>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-body font-extrabold text-ink-hint text-[9px] uppercase tracking-[0.08em]">Active Color</span>
          <span className="font-cute font-bold text-ink text-sm truncate">
            {selectedColor ? `${selectedColor.code} · ${selectedColor.name}` : 'Eraser'}
          </span>
          <span className="font-pixel-mono text-ink-hint text-sm uppercase leading-none">{selectedColor?.hex || 'Transparent'}</span>
        </div>
      </div>

      {/* Colour chart — search + family chips + grid */}
      <div className="flex flex-col gap-2 min-h-0">
        <div className="flex justify-between items-center">
          <h3 className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em]">Colors</h3>
          <span className="fsy-tag !text-xs">{filteredColors.length}/{currentPalette.colors.length}</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-hint pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code or name… (e.g. B12)"
            className="w-full h-9 pl-8 pr-8 font-body text-xs text-ink bg-paper border border-ink/30 rounded-pill placeholder:text-ink-hint outline-none focus:border-ink focus:bg-butter/30 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full text-ink-hint hover:text-ink"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Family chips — mirrors the official chart's A–M family columns */}
        <div className="flex flex-wrap gap-1">
          {['all', ...families].map((f) => (
            <button
              key={f}
              onClick={() => setFamily(f)}
              className={cn(
                'h-7 min-w-[28px] px-2 font-pixel-mono text-xs rounded-pill border transition-colors',
                family === f
                  ? 'bg-butter border-ink text-ink'
                  : 'bg-paper border-ink/25 text-ink-hint hover:border-ink hover:text-ink',
              )}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>

        <div className="relative">
          <div className="grid grid-cols-6 gap-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar pb-4">
            {filteredColors.map((color) => (
              <button
                key={color.id}
                onClick={() => handleColorSelect(color)}
                className={cn(
                  'w-full aspect-square rounded-[8px] border-[2px] transition-all duration-200 transform hover:scale-110 flex items-center justify-center',
                  selectedColor?.id === color.id ? 'border-ink ring-2 ring-butter' : 'border-ink/20 hover:border-ink',
                )}
                style={{ backgroundColor: color.hex, color: codeTextColor(color.hex) }}
                title={`${color.name} (${color.code})`}
              >
                <span className="font-pixel-mono text-[9px] leading-none opacity-90">{color.code}</span>
              </button>
            ))}
            {/* Eraser slot — always available regardless of filter */}
            <button
              onClick={() => handleColorSelect(null)}
              className={cn(
                'w-full aspect-square rounded-[8px] border-[2px] border-dashed transition-all duration-200 flex items-center justify-center bg-paper',
                selectedColor === null ? 'border-ink' : 'border-ink/30 hover:border-ink',
              )}
              title="Eraser / Transparent"
            >
              <Eraser className={cn('w-4 h-4', selectedColor === null ? 'text-ink' : 'text-ink-hint')} />
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-paper-warm to-transparent pointer-events-none z-10" />
          {filteredColors.length === 0 && (
            <p className="font-body text-ink-hint text-xs text-center py-4">
              No colours match “{query}”.
            </p>
          )}
        </div>
      </div>

      {/* Material usage */}
      {pattern && totalBeads > 0 && (
        <div className="flex flex-col gap-2 pt-4 border-t-[2px] border-ink/20">
          <div className="flex justify-between items-center">
            <h3 className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em]">Material Usage</h3>
            <span className="fsy-tag">{totalBeads} Beads</span>
          </div>
          <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
            {sortedCounts.map(([colorId, count]) => {
              const color = currentPalette.colors.find((c) => c.id === colorId);
              if (!color) return null;
              return (
                <div
                  key={colorId}
                  className="flex items-center justify-between p-1.5 bg-paper rounded-[8px] border border-ink/15"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div
                      className="w-4 h-4 rounded-full border border-ink/40 flex-shrink-0"
                      style={{
                        backgroundColor: color.hex,
                        boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.55)',
                      }}
                    />
                    <span className="font-pixel-mono text-ink text-[10px] shrink-0">{color.code}</span>
                    <span className="font-body font-semibold text-ink-soft text-[10px] truncate">{color.name}</span>
                  </div>
                  <span className="font-pixel-mono text-ink text-sm leading-none">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

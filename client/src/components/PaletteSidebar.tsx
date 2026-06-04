import React from 'react';
import { usePatternStore } from '../store/usePatternStore';
import { Hand, Paintbrush, PaintBucket, Eraser, Pipette, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface PaletteSidebarProps {
  /** Drawer-open state on mobile. Ignored on desktop (lg+) via CSS override. */
  isOpen?: boolean;
  onClose?: () => void;
}

export const PaletteSidebar: React.FC<PaletteSidebarProps> = ({ isOpen = false, onClose }) => {
  const {
    pattern,
    currentPalette,
    selectedColor,
    setSelectedColor,
    activeTool,
    setTool,
  } = usePatternStore();

  const handleColorSelect = (color: any) => {
    setSelectedColor(color);
    // Picking a colour auto-engages paint. Eraser when explicitly null.
    setTool(color ? 'paint' : 'erase');
    // Close the mobile drawer so the user returns straight to the canvas.
    // onClose is a no-op on desktop (panel is always-visible via lg: override).
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
        'flex flex-col gap-5 bg-paper-warm overflow-y-auto relative',
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

      {/* Tools — desktop only. Mobile uses a floating side rail instead. */}
      <div className="hidden lg:flex lg:flex-col lg:gap-2.5">
        <h3 className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em]">Tools</h3>
        <div className="flex gap-1 p-1 bg-paper rounded-[12px] border border-ink/20">
          {([
            { name: 'move' as const, icon: Hand, title: 'Move (Space + Drag)' },
            { name: 'paint' as const, icon: Paintbrush, title: 'Paint (B)' },
            { name: 'fill' as const, icon: PaintBucket, title: 'Fill (G)' },
            { name: 'pick' as const, icon: Pipette, title: 'Pick colour from canvas (I)' },
            { name: 'erase' as const, icon: Eraser, title: 'Erase (E)' },
          ]).map(({ name, icon: Icon, title }) => (
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
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
        <p className="font-body text-ink-hint text-[10px] italic">Tip: right-click any bead to pick its colour as the brush.</p>
      </div>

      {/* Active Color — soft card with the bead as the focal point */}
      <div className="flex items-center gap-3 p-3 bg-paper rounded-[14px] border border-ink/20">
        <div
          className="fsy-bead w-12 h-12 border-[2px] border-ink shrink-0"
          style={{
            backgroundColor: selectedColor?.hex || 'transparent',
            boxShadow: 'inset 1.5px 1.5px 0 rgba(255,255,255,0.55)',
          }}
        />
        <div className="flex flex-col min-w-0">
          <span className="font-body font-extrabold text-ink-hint text-[9px] uppercase tracking-[0.08em]">Active Color</span>
          <span className="font-cute font-bold text-ink text-sm truncate">{selectedColor?.name || 'Eraser'}</span>
          <span className="font-pixel-mono text-ink-hint text-sm uppercase leading-none">{selectedColor?.hex || 'Transparent'}</span>
        </div>
      </div>

      {/* Default Colors */}
      <div className="flex flex-col gap-2.5">
        <div className="flex justify-between items-center">
          <h3 className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em]">Default Colors</h3>
          <span className="fsy-tag !text-xs">{currentPalette.colors.length} items</span>
        </div>

        <div className="relative">
          <div className="grid grid-cols-6 gap-1.5 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar pb-4">
            {currentPalette.colors.map((color) => {
              const rgb = parseInt(color.hex.slice(1), 16);
              const r = (rgb >> 16) & 0xff, g = (rgb >> 8) & 0xff, b = rgb & 0xff;
              const brightness = (r * 299 + g * 587 + b * 114) / 1000;
              const textColor = brightness > 140 ? '#572C5F' : '#FFFFFF';

              return (
                <button
                  key={color.id}
                  onClick={() => handleColorSelect(color)}
                  className={cn(
                    'w-full aspect-square rounded-[8px] border-[2px] transition-all duration-200 transform hover:scale-110 flex items-center justify-center',
                    selectedColor?.id === color.id ? 'border-ink ring-2 ring-butter' : 'border-ink/20 hover:border-ink',
                  )}
                  style={{ backgroundColor: color.hex, color: textColor }}
                  title={`${color.name} (${color.code})`}
                >
                  <span className="font-pixel-mono text-[9px] leading-none opacity-90">{color.code}</span>
                </button>
              );
            })}
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
        </div>
      </div>

      {/* Material Stats */}
      {pattern && (
        <div className="flex flex-col gap-3 pt-5 border-t-[2px] border-ink/20">
          <div className="flex justify-between items-center">
            <h3 className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em]">Material Usage</h3>
            <span className="fsy-tag">{totalBeads} Beads</span>
          </div>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
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
                    <span className="font-body font-semibold text-ink text-[10px] truncate">{color.name}</span>
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

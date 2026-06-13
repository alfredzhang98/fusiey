/**
 * MobileToolRail — compact vertical tool strip on the right edge of the
 * designer canvas, visible only on < lg. Lets the user switch tools and
 * open the palette drawer without hunting through the Setup panel.
 *
 * Buttons (top → bottom):
 *   Move · Paint · Fill (bucket) · Erase · Clear · Palette
 *
 * "Clear" wipes every cell in the grid after a simple confirm() prompt.
 * "Palette" opens the Colours drawer (handled by the parent).
 */
import { Hand, Paintbrush, PaintBucket, Pipette, Eraser, Trash2, Palette as PaletteIcon } from 'lucide-react';
import { usePatternStore, type Tool } from '../store/usePatternStore';
import { cn } from '../lib/utils';

interface MobileToolRailProps {
  onOpenPalette: () => void;
  /** Opens the page-level styled confirm instead of window.confirm. */
  onRequestClear: () => void;
}

export function MobileToolRail({ onOpenPalette, onRequestClear }: MobileToolRailProps) {
  const { activeTool, setTool, selectedColor } = usePatternStore();

  const tools: { name: Tool; icon: typeof Hand; label: string }[] = [
    { name: 'move',  icon: Hand,        label: 'Move' },
    { name: 'paint', icon: Paintbrush,  label: 'Paint' },
    { name: 'fill',  icon: PaintBucket, label: 'Fill' },
    { name: 'pick',  icon: Pipette,     label: 'Pick colour' },
    { name: 'erase', icon: Eraser,      label: 'Erase' },
  ];

  return (
    <div
      className="lg:hidden fixed right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2"
      role="toolbar"
      aria-label="Drawing tools"
    >
      {tools.map(({ name, icon: Icon, label }) => {
        const active = activeTool === name;
        const showColorDot = name === 'paint' && active && selectedColor;
        return (
          <button
            key={name}
            onClick={() => setTool(name)}
            className={cn(
              'relative h-11 w-11 rounded-full border-[2px] border-ink flex items-center justify-center transition-colors',
              active ? 'bg-butter' : 'bg-paper hover:bg-butter/60',
            )}
            style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
            aria-label={label}
            aria-pressed={active}
          >
            <Icon className={cn('w-5 h-5 text-ink', name === 'fill' && '-scale-x-100')} />
            {/* Active paint colour shown as a small dot on the paint button. */}
            {showColorDot && (
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-ink"
                style={{ backgroundColor: selectedColor!.hex }}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}

      {/* Clear-all, destructive — cotton warning tint to differentiate. */}
      <button
        onClick={onRequestClear}
        className="h-11 w-11 rounded-full border-[2px] border-ink bg-paper hover:bg-cotton/40 flex items-center justify-center transition-colors"
        style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
        aria-label="Clear pattern"
      >
        <Trash2 className="w-5 h-5 text-ink" />
      </button>

      {/* Palette shortcut — opens the Colours drawer. Butter tint so it
          reads as "another mode" rather than just another tool. */}
      <button
        onClick={onOpenPalette}
        className="h-11 w-11 rounded-full border-[2px] border-ink bg-butter hover:bg-[#FEEB9A] flex items-center justify-center transition-colors"
        style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
        aria-label="Open palette"
      >
        <PaletteIcon className="w-5 h-5 text-ink" />
      </button>
    </div>
  );
}

import React, { useMemo } from 'react';
import type { Pattern, Palette } from '../types';

interface ExportTemplateProps {
  pattern: Pattern;
  palette: Palette;
  /** Optional reference — AI-stylised source, if available, so the exported
   *  page shows what the pattern is depicting. */
  stylizedImage?: string | null;
}

const ASSEMBLY_STEPS = [
  { num: 1, title: 'Place', text: 'Follow the pattern, place beads on a pegboard.' },
  { num: 2, title: 'Iron', text: 'Cover with parchment paper, iron on medium 15–20s.' },
  { num: 3, title: 'Cool', text: 'Let the piece cool flat for at least 2 minutes.' },
  { num: 4, title: 'Peel', text: 'Gently lift from the pegboard. Iron reverse if needed.' },
];

/**
 * Print-ready pattern template. Rendered **always mounted** but positioned
 * off-screen (`left: -99999px`); `exportPDF` / PNG capture it via html2canvas
 * without the user ever seeing it. All styling is inline — html2canvas has
 * known issues with Tailwind arbitrary-value utilities during capture, so we
 * keep everything explicit and deterministic.
 *
 * Layout: header · (grid | BOM) · assembly footer. Sized for A4-landscape
 * when exported at 2× scale (≈ 1400×990 logical → 2800×1980 PNG).
 */
export const ExportTemplate: React.FC<ExportTemplateProps> = ({ pattern, palette, stylizedImage }) => {
  const bom = useMemo(() => {
    const counts = new Map<string, number>();
    pattern.grid.forEach((row) => {
      row.forEach((cell) => {
        if (cell.colorId) counts.set(cell.colorId, (counts.get(cell.colorId) || 0) + 1);
      });
    });
    const list = [...counts.entries()]
      .map(([id, count]) => {
        const color = palette.colors.find((c) => c.id === id);
        return color ? { color, count } : null;
      })
      .filter((e): e is { color: Palette['colors'][number]; count: number } => !!e)
      .sort((a, b) => b.count - a.count);
    const total = list.reduce((s, e) => s + e.count, 0);
    return { list, total };
  }, [pattern, palette]);

  // Cell size tuned so the grid fits in the allotted ~820 px column regardless
  // of board dimensions (50×50 → 16 px, 100×100 → 8 px).
  const CELL = Math.max(6, Math.floor(820 / Math.max(pattern.width, pattern.height)));
  const dateStr = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });

  return (
    <div
      id="export-template"
      style={{
        position: 'absolute',
        left: '-99999px',
        top: 0,
        width: 1400,
        minHeight: 990,
        background: '#FDFBF5',
        padding: 40,
        fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
        color: '#2D2D2D',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 20,
          borderBottom: '3px solid #2D2D2D',
          paddingBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 1, lineHeight: 1 }}>FUSIEY</div>
          <div style={{ fontSize: 11, color: '#6B6B6B', marginTop: 4, letterSpacing: 2 }}>PERLER-BEAD PATTERN</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{pattern.name || 'Untitled Pattern'}</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
            {pattern.width} × {pattern.height} · {bom.total} beads · {bom.list.length} colours · {palette.name}
          </div>
        </div>
      </div>

      {/* Body: grid (with optional reference) + BOM */}
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {stylizedImage && (
            <div style={{ marginBottom: 16, alignSelf: 'flex-start' }}>
              <div style={{ fontSize: 10, color: '#6B6B6B', marginBottom: 6, letterSpacing: 2 }}>REFERENCE</div>
              <img
                src={stylizedImage}
                alt="reference"
                style={{
                  width: 140,
                  height: 140,
                  objectFit: 'contain',
                  background: '#FFF',
                  border: '2px solid #2D2D2D',
                  borderRadius: 10,
                }}
              />
            </div>
          )}
          <div style={{ fontSize: 10, color: '#6B6B6B', marginBottom: 6, letterSpacing: 2, alignSelf: 'flex-start' }}>PATTERN</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${pattern.width}, ${CELL}px)`,
              gap: 0,
              border: '2px solid #2D2D2D',
              padding: 0,
              background: '#FFF',
              width: 'fit-content',
            }}
          >
            {pattern.grid.map((row, y) =>
              row.map((cell, x) => {
                const color = cell.colorId ? palette.colors.find((c) => c.id === cell.colorId) : null;
                return (
                  <div
                    key={`${x}-${y}`}
                    style={{
                      width: CELL,
                      height: CELL,
                      background: color?.hex ?? '#FFF',
                      boxSizing: 'border-box',
                      borderRight: x < pattern.width - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                      borderBottom: y < pattern.height - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                      position: 'relative',
                    }}
                  >
                    {!color && (
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: Math.max(6, CELL * 0.55),
                          color: '#C8C8C8',
                          fontFamily: 'monospace',
                        }}
                      >
                        ×
                      </span>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        <div style={{ flex: '0 0 360px' }}>
          <div style={{ fontSize: 10, color: '#6B6B6B', marginBottom: 8, letterSpacing: 2 }}>
            BEAD LIST · {bom.list.length} COLOURS
          </div>
          <div
            style={{
              background: '#FFF',
              border: '2px solid #2D2D2D',
              borderRadius: 10,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              fontSize: 12,
            }}
          >
            {bom.list.map(({ color, count }) => (
              <div
                key={color.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '5px 2px',
                  borderBottom: '1px dashed #EEE',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: color.hex,
                    border: '1px solid #2D2D2D',
                    flex: '0 0 auto',
                  }}
                />
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontSize: 11,
                    fontWeight: 700,
                    minWidth: 38,
                  }}
                >
                  {color.code}
                </div>
                <div
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 11.5,
                  }}
                >
                  {color.name}
                </div>
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  × {count}
                </div>
              </div>
            ))}
            <div
              style={{
                marginTop: 8,
                paddingTop: 10,
                borderTop: '2px solid #2D2D2D',
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              <span>Total</span>
              <span>{bom.total} beads</span>
            </div>
          </div>

          {/* Material "sticker" — lightweight brand block so printed sheets
              are self-identifying without pulling in the homepage sticker CSS. */}
          <div
            style={{
              marginTop: 14,
              background: '#FFF4B8',
              border: '2px solid #2D2D2D',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: '#2D2D2D',
                color: '#FFF4B8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 13,
              }}
            >
              F
            </div>
            <div style={{ flex: 1, lineHeight: 1.3 }}>
              <div style={{ fontWeight: 800, fontSize: 12 }}>Fusiey Pattern Kit</div>
              <div style={{ fontSize: 10, color: '#555' }}>Standard 5 mm midi beads</div>
            </div>
            <div
              style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 10,
                color: '#555',
              }}
            >
              {pattern.width}×{pattern.height}
            </div>
          </div>
        </div>
      </div>

      {/* Footer: assembly steps */}
      <div style={{ marginTop: 28, paddingTop: 18, borderTop: '2px solid #2D2D2D' }}>
        <div style={{ fontSize: 10, color: '#6B6B6B', marginBottom: 10, letterSpacing: 2 }}>ASSEMBLY</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {ASSEMBLY_STEPS.map((s) => (
            <div
              key={s.num}
              style={{
                padding: '10px 12px',
                background: '#FFF',
                border: '1.5px solid #2D2D2D',
                borderRadius: 8,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 3 }}>
                {s.num}. {s.title}
              </div>
              <div style={{ fontSize: 10, color: '#555', lineHeight: 1.45 }}>{s.text}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 10,
            color: '#888',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Generated {dateStr}</span>
          <span>fusiey.com</span>
        </div>
      </div>
    </div>
  );
};

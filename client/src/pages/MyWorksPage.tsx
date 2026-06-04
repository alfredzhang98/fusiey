import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Upload } from 'lucide-react';
import { patternsApi, type PatternSummary, ApiError } from '../services/api';

export function MyWorksPage() {
  const [patterns, setPatterns] = useState<PatternSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { patterns } = await patternsApi.list();
        if (!cancelled) setPatterns(patterns);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pattern? This cannot be undone.')) return;
    try {
      await patternsApi.remove(id);
      setPatterns((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-cute font-bold text-ink text-3xl">My Works</h1>
          <p className="font-body text-ink-hint text-sm mt-1">
            All your saved bead patterns — AI-generated and hand-drawn.
          </p>
        </div>
        <button
          onClick={() => navigate('/designer?mode=manual')}
          className="h-10 px-4 bg-cotton hover:bg-accent-hover text-ink font-cute font-semibold text-sm rounded-pill border-[2px] border-ink flex items-center gap-2"
          style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
        >
          <Upload className="w-4 h-4" />
          New blank pattern
        </button>
      </div>

      {loading && (
        <p className="font-body text-ink-hint">Loading…</p>
      )}
      {error && (
        <p className="font-body text-red-600">{error}</p>
      )}

      {!loading && !error && patterns.length === 0 && (
        <div className="text-center py-16 font-body text-ink-hint">
          No patterns yet. Head to the{' '}
          <Link to="/designer" className="text-ink font-semibold underline">
            designer
          </Link>{' '}
          to make your first one!
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {patterns.map((p) => (
          <div
            key={p.id}
            className="relative group bg-paper border-[2px] border-ink/30 hover:border-ink rounded-[14px] overflow-hidden transition-colors"
          >
            <Link to={`/designer?id=${p.id}`} className="block">
              {p.thumbnail ? (
                <img src={p.thumbnail} alt={p.name} className="w-full aspect-square object-cover bg-paper-warm" />
              ) : (
                <div className="w-full aspect-square bg-paper-warm flex items-center justify-center font-pixel-mono text-ink-hint text-xs">
                  {p.width}×{p.height}
                </div>
              )}
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <span className="font-cute font-semibold text-ink text-sm truncate flex-1">
                    {p.name}
                  </span>
                  {p.isPublished && (
                    <span className="font-pixel-mono text-[9px] text-ink bg-butter px-1.5 py-0.5 rounded">
                      PUBLISHED
                    </span>
                  )}
                </div>
                <div className="font-body text-ink-hint text-[11px] mt-1">
                  {p.source} · {new Date(p.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </Link>
            <button
              onClick={() => handleDelete(p.id)}
              title="Delete pattern"
              className="absolute top-2 right-2 h-7 w-7 bg-paper/90 hover:bg-red-50 border border-ink/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

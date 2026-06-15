import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Upload, Loader2, Package, Download, FileText, ShoppingBag } from 'lucide-react';
import { patternsApi, type PatternSummary, type PatternPurchase, ApiError } from '../services/api';
import { renderThumbnail } from '../utils/patternThumbnail';
import { PALETTES } from '../constants/palettes';
import { imgFallback } from '../lib/utils';
import { ConfirmDialog } from '../components/ConfirmDialog';

const PAGE_SIZE = 12;

/**
 * Pattern preview. Loads the cached PNG from /patterns/:id/thumbnail (lazy +
 * HTTP-cached). For older patterns with no stored thumbnail the endpoint 404s,
 * so we render one from the grid once and back it up — next time it's served
 * (and cached) straight from the endpoint.
 */
function PatternThumb({ p }: { p: PatternSummary }) {
  const [override, setOverride] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const renderFallback = async () => {
    try {
      const { pattern } = await patternsApi.get(p.id);
      const palette = PALETTES.find((pl) => pl.id === pattern.paletteId) || PALETTES[0];
      const dataUrl = renderThumbnail(
        {
          id: pattern.id, name: pattern.name, width: pattern.width, height: pattern.height,
          grid: pattern.grid, paletteId: pattern.paletteId, beadSize: pattern.beadSize,
        },
        palette,
      );
      setOverride(dataUrl);
      patternsApi.patch(p.id, { thumbnail: dataUrl }).catch(() => { /* best-effort backfill */ });
    } catch {
      setFailed(true);
    }
  };

  if (override) {
    return <img src={override} alt={p.name} className="w-full h-full object-contain bg-paper-warm" />;
  }
  if (failed) {
    return (
      <div className="w-full h-full bg-paper-warm flex items-center justify-center font-pixel-mono text-ink-hint text-xs">
        {p.width}×{p.height}
      </div>
    );
  }
  return (
    <img
      src={patternsApi.thumbnailUrl(p.id)}
      alt={p.name}
      loading="lazy"
      className="w-full h-full object-contain bg-paper-warm"
      onError={renderFallback}
    />
  );
}

export function MyWorksPage() {
  const [myDesigns, setMyDesigns] = useState<PatternSummary[]>([]);
  const [certified, setCertified] = useState<PatternSummary[]>([]);
  const [downloads, setDownloads] = useState<PatternPurchase[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PatternSummary | null>(null);
  const navigate = useNavigate();

  const loadPage = async (pageNum: number) => {
    const res = await patternsApi.list({ page: pageNum, limit: PAGE_SIZE, purchased: false });
    setMyDesigns((prev) => (pageNum === 1 ? res.patterns : [...prev, ...res.patterns]));
    setTotalPages(res.totalPages);
    setPage(pageNum);
  };

  useEffect(() => {
    loadPage(1)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
    // Purchased: certified (editable) patterns + non-certified (download) files.
    patternsApi.list({ purchased: true, limit: 50 }).then((r) => setCertified(r.patterns)).catch(() => {});
    patternsApi.purchases().then((r) => setDownloads(r.purchases)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = () => {
    setLoadingMore(true);
    loadPage(page + 1).catch(() => {}).finally(() => setLoadingMore(false));
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await patternsApi.remove(id);
      setMyDesigns((prev) => prev.filter((p) => p.id !== id));
      setCertified((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  const empty = !loading && !error && myDesigns.length === 0 && certified.length === 0 && downloads.length === 0;

  // Card for an editable SavedPattern (own design or certified purchase).
  const patternCard = (p: PatternSummary) => (
    <div
      key={p.id}
      className="relative group bg-paper border-[2px] border-ink/30 hover:border-ink rounded-[14px] overflow-hidden transition-colors"
    >
      <Link to={`/designer?load=${p.id}`} className="block" title="Open in designer">
        <div className="w-full aspect-square overflow-hidden">
          <PatternThumb p={p} />
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2">
            <span className="font-cute font-semibold text-ink text-sm truncate flex-1">{p.name}</span>
            {(p.isPurchased || p.source === 'OFFICIAL') && (
              <span className="font-pixel-mono text-[9px] text-ink bg-mint px-1.5 py-0.5 rounded">CERTIFIED</span>
            )}
            {p.isPublished && (
              <span className="font-pixel-mono text-[9px] text-ink bg-butter px-1.5 py-0.5 rounded">PUBLISHED</span>
            )}
          </div>
          <div className="font-body text-ink-hint text-[11px] mt-1">
            {new Date(p.updatedAt).toLocaleDateString()}
          </div>
        </div>
      </Link>
      <button
        onClick={() => navigate(`/custom-order?pattern=${p.id}`)}
        title="Order a kit for this design"
        className="absolute top-2 right-11 h-7 w-7 bg-paper/90 hover:bg-mint/50 border border-ink/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ShoppingBag className="w-3.5 h-3.5 text-ink" />
      </button>
      <button
        onClick={() => setDeleteTarget(p)}
        title="Delete pattern"
        className="absolute top-2 right-2 h-7 w-7 bg-paper/90 hover:bg-red-50 border border-ink/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-3.5 h-3.5 text-red-600" />
      </button>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-cute font-bold text-ink text-3xl">My Works</h1>
          <p className="font-body text-ink-hint text-sm mt-1">Your saved designs and purchases.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/custom-order')}
            className="h-10 px-4 bg-mint hover:bg-mint/80 text-ink font-cute font-semibold text-sm rounded-pill border-[2px] border-ink flex items-center gap-2"
            style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
          >
            <ShoppingBag className="w-4 h-4" />
            Order a kit for my design
          </button>
          <button
            onClick={() => navigate('/designer?new=1')}
            className="h-10 px-4 bg-cotton hover:bg-accent-hover text-ink font-cute font-semibold text-sm rounded-pill border-[2px] border-ink flex items-center gap-2"
            style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
          >
            <Upload className="w-4 h-4" />
            New blank pattern
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-ink-hint">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="font-body">Loading…</span>
        </div>
      )}
      {error && <p className="font-body text-red-600">{error}</p>}

      {empty && (
        <div className="text-center py-16">
          <Package className="w-14 h-14 text-ink-hint mx-auto mb-4" />
          <p className="font-body text-ink-hint">
            No patterns yet. Head to the{' '}
            <Link to="/designer?new=1" className="text-ink font-semibold underline">designer</Link>{' '}
            to make your first one!
          </p>
        </div>
      )}

      {/* ── Purchased (certified patterns + downloaded files) — at the top ── */}
      {!loading && (certified.length > 0 || downloads.length > 0) && (
        <section className="mb-10">
          <h2 className="font-cute font-bold text-ink text-xl mb-1">Purchased</h2>
          <p className="font-body text-ink-hint text-sm mb-4">
            Patterns you've bought — open certified ones in the designer, or download your files.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 sm:gap-4">
            {certified.map(patternCard)}
            {downloads.map((d) => {
              const files = d.fileUrls?.length ? d.fileUrls : [d.fileUrl];
              return (
                <div key={d.id} className="bg-paper border-[2px] border-ink/30 rounded-[14px] overflow-hidden">
                  <div className="w-full aspect-square overflow-hidden bg-paper-warm flex items-center justify-center">
                    {d.fileType === 'png' ? (
                      <img src={files[0]} alt={d.name} loading="lazy" onError={imgFallback} className="w-full h-full object-contain" />
                    ) : (
                      <FileText className="w-12 h-12 text-ink-hint" />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-cute font-semibold text-ink text-sm truncate flex-1">{d.name}</span>
                      <span className="font-pixel-mono text-[9px] text-ink bg-sky-candy px-1.5 py-0.5 rounded">
                        {d.fileType.toUpperCase()}{files.length > 1 ? ` ×${files.length}` : ''}
                      </span>
                    </div>
                    {files.length === 1 ? (
                      <a
                        href={files[0]}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 w-full fsy-btn fsy-btn-sm bg-cotton gap-1.5 justify-center"
                      >
                        <Download className="w-4 h-4" /> Download
                      </a>
                    ) : (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {files.map((u, i) => (
                          <a
                            key={u}
                            href={u}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="w-full fsy-btn fsy-btn-sm bg-cotton gap-1.5 justify-center"
                          >
                            <Download className="w-4 h-4" /> Page {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── My designs (own hand-made / AI patterns) ── */}
      {!loading && myDesigns.length > 0 && (
        <section>
          <h2 className="font-cute font-bold text-ink text-xl mb-4">My designs</h2>
          <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 sm:gap-4">
            {myDesigns.map(patternCard)}
          </div>
          {page < totalPages && (
            <div className="text-center mt-8">
              <button onClick={loadMore} disabled={loadingMore} className="fsy-btn bg-paper disabled:opacity-50">
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load more'}
              </button>
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this pattern?"
        message={`"${deleteTarget?.name ?? ''}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

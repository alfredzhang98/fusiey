import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { LEGAL_BY_SLUG, LEGAL_DOCS } from '../constants/legalContent';

export function LegalPage() {
  const { slug } = useParams<{ slug: string }>();
  const doc = slug ? LEGAL_BY_SLUG[slug] : undefined;

  if (!doc) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <FileText className="w-14 h-14 text-ink-hint mx-auto mb-4" />
        <h1 className="font-cute font-bold text-ink text-2xl mb-3">Policy not found</h1>
        <div className="flex flex-wrap justify-center gap-2">
          {LEGAL_DOCS.map((d) => (
            <Link key={d.slug} to={`/legal/${d.slug}`} className="fsy-tag bg-butter">{d.title}</Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <Link
        to="/"
        className="inline-flex items-center gap-2 font-cute font-semibold text-sm text-ink-hint hover:text-ink mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Home
      </Link>

      <h1 className="font-cute font-bold text-ink text-3xl mb-1">{doc.title}</h1>
      <p className="font-body text-ink-hint text-xs mb-6">{doc.updated}</p>

      <p className="font-body text-ink-soft text-sm leading-relaxed mb-8">{doc.intro}</p>

      <div className="space-y-6">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="font-cute font-bold text-ink text-lg mb-2">{s.heading}</h2>
            <p className="font-body text-ink-soft text-sm leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>

      {/* Cross-links to the other policies */}
      <div className="mt-10 pt-6 border-t-[2px] border-ink/15 flex flex-wrap gap-2">
        {LEGAL_DOCS.filter((d) => d.slug !== doc.slug).map((d) => (
          <Link key={d.slug} to={`/legal/${d.slug}`} className="fsy-tag bg-paper hover:bg-butter transition-colors">
            {d.title}
          </Link>
        ))}
      </div>
    </div>
  );
}

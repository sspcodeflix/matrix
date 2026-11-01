import type { ReactNode } from 'react';
import { Icon } from './Icon';

export type PillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'outline';

/** Status pill. Red = needs attention / gap, green = passed or covered, amber = warning or stale. */
export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`pill ${tone === 'neutral' ? '' : `tone-${tone}`}`}>{children}</span>;
}

export function Chip({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`chip ${tone === 'neutral' ? '' : `tone-${tone}`}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="spread" style={{ alignItems: 'flex-end' }}>
      <div className="stack" style={{ gap: 6 }}>
        <h1>{title}</h1>
        {subtitle && <span className="small muted" style={{ fontSize: 13 }}>{subtitle}</span>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, unit, note, tone }: {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  note?: ReactNode;
  tone?: 'accent' | 'success' | 'warning';
}) {
  const color = tone === 'accent' ? 'var(--accent-text)' : tone === 'success' ? 'var(--success-text)' : tone === 'warning' ? 'var(--warning-text)' : undefined;
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ color }}>
        {value} {unit && <small>{unit}</small>}
      </span>
      {note && <span className="mono small muted" style={{ fontSize: 11 }}>{note}</span>}
    </div>
  );
}

export function Card({ title, actions, children, className = '', pad = true, attention }: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
  attention?: boolean;
}) {
  return (
    <section className={`card ${attention ? 'attention' : ''} ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {typeof title === 'string' ? <h2 style={{ fontSize: 16 }}>{title}</h2> : title}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={pad ? 'card-pad' : undefined}>{children}</div>
    </section>
  );
}

/** Secondary "Download report" action; opens the shared download dialog. */
export function DownloadButton({ label = 'Download report', onClick }: { label?: string; onClick: () => void }) {
  return (
    <button type="button" className="btn" aria-haspopup="dialog" onClick={onClick}>
      <Icon name="download" size={16} strokeWidth={2} />
      {label}
    </button>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <div className="page muted" role="status">{label}…</div>;
}

export function ErrorState({ error }: { error: Error }) {
  return (
    <div className="page">
      <div className="banner accent" role="alert">
        <Icon name="warning" />
        <span>Could not load this screen: {error.message}</span>
      </div>
    </div>
  );
}

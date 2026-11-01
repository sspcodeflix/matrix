import { useEffect, useRef, useState, type ReactNode } from 'react';
import { pct, type CoverageCounts, type TrendPoint } from './api';
import styles from './Overview.module.css';

/*
 * Coverage tiers use the product's status meanings: green covered, amber has cases only,
 * grey awaiting evidence or stale, red no test (the gap). Green and amber sit close for
 * protan readers, so every bar also has 2px gaps, a legend, value labels and a table view.
 */
const TIERS: { key: keyof CoverageCounts; label: string; cls: string }[] = [
  { key: 'passing', label: 'Automated and passing', cls: styles.tPass },
  { key: 'casesOnly', label: 'Test cases, not automated', cls: styles.tCases },
  { key: 'awaiting', label: 'Awaiting evidence or stale', cls: styles.tAwait },
  { key: 'noTest', label: 'No test', cls: styles.tGap },
];

export function TierLegend() {
  return (
    <ul className={styles.legend} aria-label="Legend">
      {TIERS.map((t) => (
        <li key={t.key}><span className={`${styles.swatch} ${t.cls}`} aria-hidden="true" />{t.label}</li>
      ))}
    </ul>
  );
}

/** The legend with each tier's count, e.g. under a single application's bar. */
export function TierCounts({ counts }: { counts: CoverageCounts }) {
  return (
    <ul className={`${styles.legend} ${styles.tierCounts}`} aria-label="Requirements by coverage tier">
      {TIERS.map((t) => (
        <li key={t.key}>
          <span className={`${styles.swatch} ${t.cls}`} aria-hidden="true" />
          {t.label} <strong className={styles.tierCount}>{counts[t.key]}</strong>
        </li>
      ))}
    </ul>
  );
}

export interface BarRow {
  id: string;
  label: ReactNode;
  sublabel?: ReactNode;
  /** Undefined: Not measured (no completed scan). Never drawn as 0%. */
  counts?: CoverageCounts;
  onSelect?: () => void;
}

/** Horizontal 100% stacked bars, one per row; the value at the tip is covered of in-scope. */
export function CoverageBars({ rows, caption }: { rows: BarRow[]; caption: string }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const show = (e: { clientX: number; clientY: number }, text: string) => {
    const box = wrap.current?.getBoundingClientRect();
    if (box) setTip({ x: e.clientX - box.left, y: e.clientY - box.top, text });
  };

  return (
    <div ref={wrap} className={styles.bars} onMouseLeave={() => setTip(null)}>
      <span className="sr-only">{caption}. The table below lists every value.</span>
      {rows.map((r) => {
        const total = r.counts ? r.counts.passing + r.counts.casesOnly + r.counts.awaiting + r.counts.noTest : 0;
        const label = (
          <span className={styles.barLabel}>
            <span>{r.label}</span>
            {r.sublabel && <span className="small muted">{r.sublabel}</span>}
          </span>
        );
        return (
          <div key={r.id} className={styles.barRow}>
            {r.onSelect ? (
              <button type="button" className={styles.barLabelBtn} onClick={r.onSelect}>{label}</button>
            ) : label}
            {r.counts && total > 0 ? (
              <>
                <div className={styles.track} role="img" aria-label={`${r.id}: ${TIERS.map((t) => `${t.label} ${r.counts![t.key]}`).join(', ')}`}>
                  {TIERS.map((t) => {
                    const n = r.counts![t.key];
                    if (!n) return null;
                    const text = `${t.label}: ${n} of ${total} (${pct(n, total)}%)`;
                    return (
                      <span
                        key={t.key}
                        className={`${styles.seg} ${t.cls}`}
                        style={{ flexGrow: n }}
                        onMouseMove={(e) => show(e, text)}
                      />
                    );
                  })}
                </div>
                <span className={styles.barValue}>
                  <strong>{pct(r.counts.passing, total)}%</strong>
                  <span className="small muted"> {r.counts.passing} of {total}</span>
                </span>
              </>
            ) : (
              <>
                <div className={`${styles.track} ${styles.unmeasured}`} aria-hidden="true" />
                <span className={styles.barValue}><span className="small muted">Not measured</span></span>
              </>
            )}
          </div>
        );
      })}
      {tip && (
        <div className={styles.tooltip} style={{ left: tip.x + 12, top: tip.y + 12 }} role="presentation">{tip.text}</div>
      )}
    </div>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Coverage % by month, with Matrix-written coverage as a second series on the same % axis. */
export function CoverageTrendChart({ points }: { points: TrendPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const h = 220;
  const m = { top: 16, right: 56, bottom: 28, left: 36 };
  const iw = width - m.left - m.right;
  const ih = h - m.top - m.bottom;
  const x = (i: number) => m.left + (points.length > 1 ? (i / (points.length - 1)) * iw : iw / 2);
  const y = (v: number) => m.top + ih - (v / 100) * ih;
  const series = [
    { key: 'covered', label: 'Automated and passing', cls: styles.lineCovered, value: (p: TrendPoint) => pct(p.covered, p.inScope) },
    { key: 'matrix', label: 'Of which Matrix-written', cls: styles.lineMatrix, value: (p: TrendPoint) => pct(p.matrixWritten, p.inScope) },
  ];
  const last = points.length - 1;

  return (
    <div ref={ref} className={styles.trend}>
      <ul className={styles.legend} aria-label="Legend">
        {series.map((s) => (
          <li key={s.key}><span className={`${styles.swatchLine} ${s.cls}`} aria-hidden="true" />{s.label}</li>
        ))}
      </ul>
      <svg
        width={width}
        height={h}
        role="img"
        aria-label={`Coverage by month: ${points.map((p) => `${p.month} ${pct(p.covered, p.inScope)}%`).join(', ')}`}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={m.left} x2={m.left + iw} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className={styles.axis}>{t}%</text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={p.month} x={x(i)} y={h - 8} textAnchor="middle" className={styles.axis}>{p.month}</text>
        ))}
        {series.map((s) => (
          <g key={s.key}>
            <polyline
              className={`${styles.line} ${s.cls}`}
              points={points.map((p, i) => `${x(i)},${y(s.value(p))}`).join(' ')}
            />
            <circle cx={x(last)} cy={y(s.value(points[last]))} r={4} className={`${styles.dot} ${s.cls}`} />
            <text x={x(last) + 10} y={y(s.value(points[last]))} dy="0.32em" className={styles.endLabel}>
              {s.value(points[last])}%
            </text>
          </g>
        ))}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + ih} className={styles.crosshair} />
        )}
        {points.map((p, i) => (
          <rect
            key={p.month}
            x={x(i) - iw / Math.max(1, points.length - 1) / 2}
            y={m.top}
            width={iw / Math.max(1, points.length - 1)}
            height={ih}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {hover !== null && (
        <div className={styles.tooltip} style={{ left: Math.min(x(hover) + 12, width - 200), top: 40 }} role="presentation">
          <strong>{points[hover].month}</strong>
          <br />
          {pct(points[hover].covered, points[hover].inScope)}% · {points[hover].covered} of {points[hover].inScope} requirements
          <br />
          Matrix-written: {points[hover].matrixWritten}
        </div>
      )}
    </div>
  );
}

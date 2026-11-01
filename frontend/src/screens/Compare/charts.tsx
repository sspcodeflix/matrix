import { useState } from 'react';
import type { ScanPoint } from './api';
import styles from './Compare.module.css';

/*
 * Inline-SVG charts for Compare scans. Colours come from tokens; every value is printed as text,
 * and a visually hidden table carries the same numbers for screen readers.
 */

const fill = (token: string) => ({ fill: `var(${token})` });

export function CoverageTrend({ scans, baselineId, compareId }: { scans: ScanPoint[]; baselineId: string; compareId: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 1100;
  const H = 230;
  const top = 26;
  const plotH = 170;
  const n = scans.length;
  const slot = W / Math.max(n, 1);
  const barW = Math.min(44, slot * 0.5);
  const y = (pct: number) => top + plotH - (pct / 100) * plotH;
  const hovered = scans.find((s) => s.scanId === hover);
  const first = scans[0];
  const last = scans[scans.length - 1];

  return (
    <div className={styles.chartWrap}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.trendSvg}
        role="img"
        aria-label={
          first && last
            ? `Automated coverage went from ${first.otherPct + first.matrixPct}% on ${first.label} to ${last.otherPct + last.matrixPct}% on ${last.label}. Matrix-written automation went from ${first.matrixPct}% to ${last.matrixPct}%.`
            : 'No scans'
        }
        onMouseLeave={() => setHover(null)}
      >
        {scans.map((s, i) => {
          const cx = slot * i + slot / 2;
          const x = cx - barW / 2;
          const total = s.otherPct + s.matrixPct;
          const outlined = s.scanId === baselineId || s.scanId === compareId;
          const gap = 2;
          return (
            <g key={s.scanId} onMouseEnter={() => setHover(s.scanId)}>
              <title>{`${s.label} (${s.scanId}): other ${s.otherPct}%, Matrix ${s.matrixPct}%, total ${total}% of ${s.totalFRs} requirements`}</title>
              {/* hit target larger than the mark */}
              <rect x={cx - slot / 2} y={0} width={slot} height={H} fill="transparent" />
              <rect x={x} y={top} width={barW} height={Math.max(0, y(total) - top - gap)} rx={3} style={fill('--border')} />
              {s.matrixPct > 0 && (
                <rect x={x} y={y(total)} width={barW} height={Math.max(0, y(s.otherPct) - y(total) - gap)} style={fill('--accent')} />
              )}
              <rect x={x} y={y(s.otherPct)} width={barW} height={top + plotH - y(s.otherPct)} rx={3} style={fill('--inverse-bg')} />
              {outlined && (
                <rect x={x - 4} y={top - 4} width={barW + 8} height={plotH + 8} rx={5} fill="none" strokeWidth={2} style={{ stroke: 'var(--accent)' }} />
              )}
              <text x={cx} y={16} textAnchor="middle" className={styles.svgValue}>{total}%</text>
              <text x={cx} y={H - 6} textAnchor="middle" className={styles.svgAxis}>{s.label}</text>
              {hover === s.scanId && <rect x={x - 4} y={top - 4} width={barW + 8} height={plotH + 8} rx={5} fill="none" strokeWidth={1} strokeDasharray="3 3" style={{ stroke: 'var(--text-muted)' }} />}
            </g>
          );
        })}
      </svg>
      <p className={styles.hoverLine} aria-hidden="true">
        {hovered
          ? `${hovered.label} · ${hovered.scanId}: other automation ${hovered.otherPct}% + Matrix-written ${hovered.matrixPct}% = ${hovered.otherPct + hovered.matrixPct}% of ${hovered.totalFRs} requirements`
          : 'Hover a bar for its split.'}
      </p>
      <table className="sr-only">
        <caption>Automated coverage by scan</caption>
        <thead>
          <tr><th scope="col">Scan</th><th scope="col">Date</th><th scope="col">Other automation</th><th scope="col">Matrix-written</th><th scope="col">Total</th></tr>
        </thead>
        <tbody>
          {scans.map((s) => (
            <tr key={s.scanId}>
              <td>{s.scanId}</td><td>{s.date}</td><td>{s.otherPct}%</td><td>{s.matrixPct}%</td><td>{s.otherPct + s.matrixPct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface BridgeRow {
  label: string;
  /** Points; for start/end rows this is the level. */
  value: number;
  kind: 'level' | 'newReqs' | 'other' | 'matrix';
}

const bridgeColor: Record<BridgeRow['kind'], string> = {
  level: '--border-strong',
  newReqs: '--warning',
  other: '--inverse-bg',
  matrix: '--accent',
};

/** Waterfall from the baseline level to the compared level, one row per contribution. */
export function CoverageBridge({ rows }: { rows: BridgeRow[] }) {
  let running = 0;
  return (
    <ul className={styles.bridge}>
      {rows.map((r) => {
        let from: number;
        let to: number;
        if (r.kind === 'level') {
          from = 0;
          to = r.value;
          running = r.value;
        } else {
          from = running;
          to = running + r.value;
          running = to;
        }
        const left = Math.max(0, Math.min(from, to));
        const width = Math.max(0.6, Math.abs(to - from));
        const text = r.kind === 'level' ? `${r.value}%` : `${r.value >= 0 ? '+' : '−'}${Math.abs(r.value)} pts`;
        return (
          <li key={r.label} className={styles.bridgeRow}>
            <span className={styles.bridgeLabel}>
              <span className="secondary">{r.label}</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{text}</span>
            </span>
            <svg viewBox="0 0 100 14" preserveAspectRatio="none" className={styles.bridgeSvg} aria-hidden="true">
              <rect x={0} y={0} width={100} height={14} rx={3} style={fill('--bg-subtle')} />
              <rect x={left} y={0} width={width} height={14} rx={1.5} style={fill(bridgeColor[r.kind])} />
            </svg>
          </li>
        );
      })}
    </ul>
  );
}

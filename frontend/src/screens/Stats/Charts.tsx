import { useEffect, useRef, useState } from 'react';
import type { DayTokens, WeekTests } from './api';
import styles from './Stats.module.css';

/*
 * Inline-SVG charts for User stats. Colours come from tokens only:
 * acceptance = var(--text) (neutral ink), regression = var(--accent).
 * Every bar has a <title> and a hover/focus readout; values are also printed.
 */

/** Tracks the rendered width so SVG text stays at its real pixel size. */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const ACCEPTANCE = 'var(--text)';
const REGRESSION = 'var(--accent)';

/** Path for a bar with 4px rounded top corners, anchored to the baseline. */
function barPath(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function WeeklyTestsChart({ weeks }: { weeks: WeekTests[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const [ref, W] = useWidth(480);
  const H = 150;
  const top = 18;
  const base = H - 22;
  const max = Math.max(...weeks.flatMap((w) => [w.acceptance, w.regression]), 1);
  const group = W / weeks.length;
  const bw = Math.min(30, group / 3);
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  const scale = (v: number) => ((base - top) * v) / max;

  return (
    <div className={styles.chartWrap} ref={ref}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.svg}
        role="img"
        aria-label={`Weekly tests created, from ${first.acceptance + first.regression} in the week of ${first.weekStart} to ${last.acceptance + last.regression} in the week of ${last.weekStart}. ${weeks
          .map((w) => `${w.weekStart}: ${w.acceptance} acceptance, ${w.regression} regression`)
          .join('; ')}.`}
      >
        <line x1={0} x2={W} y1={base + 0.5} y2={base + 0.5} style={{ stroke: 'var(--border)' }} />
        {weeks.map((w, i) => {
          const cx = group * i + group / 2;
          const bars = [
            { key: 'acceptance', v: w.acceptance, x: cx - bw - 1, fill: ACCEPTANCE },
            { key: 'regression', v: w.regression, x: cx + 1, fill: REGRESSION },
          ];
          return (
            <g key={w.weekStart}>
              {bars.map((b) => {
                const id = `${w.weekStart}-${b.key}`;
                const h = scale(b.v);
                return (
                  <g key={b.key} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}>
                    <title>{`Week of ${w.weekStart}: ${b.v} ${b.key}`}</title>
                    <rect x={b.x - 2} y={top} width={bw + 4} height={base - top} fill="transparent" />
                    <path d={barPath(b.x, base - h, bw, h)} style={{ fill: b.fill, opacity: hover && hover !== id ? 0.55 : 1 }} />
                    <text x={b.x + bw / 2} y={base - h - 5} textAnchor="middle" className={styles.valueLabel}>{b.v}</text>
                  </g>
                );
              })}
              <text x={cx} y={H - 6} textAnchor="middle" className={styles.axisLabel}>{w.weekStart}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DailyTokensChart({ days }: { days: DayTokens[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [ref, W] = useWidth(760);
  const H = 200;
  const left = 34;
  const top = 10;
  const base = H - 24;
  const max = Math.max(2.5, Math.ceil(Math.max(...days.map((d) => d.tokensM))));
  const step = (W - left) / days.length;
  const bw = step - 2; // 2px surface gap between adjacent bars
  const scale = (v: number) => ((base - top) * v) / max;
  const ticks = Array.from({ length: Math.floor(max) + 1 }, (_, i) => i);
  const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const peak = days.reduce((a, b) => (b.tokensM > a.tokensM ? b : a), days[0]);
  const labelIdx = [0, Math.floor((days.length - 1) / 2), days.length - 1];
  const shown = active !== null ? days[active] : null;

  return (
    <div className={styles.chartWrap} ref={ref}>
      <p className={`small secondary ${styles.readout}`} aria-live="polite">
        {shown ? (
          <>
            <strong>{fmt(shown.day)}</strong> · <span className="mono">{shown.tokensM.toFixed(1)}M</span> tokens{shown.weekend ? ' · weekend' : ''}
          </>
        ) : (
          <>
            Peak <strong>{fmt(peak.day)}</strong> · <span className="mono">{peak.tokensM.toFixed(1)}M</span> tokens · hover a bar for the day
          </>
        )}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.svg}
        role="img"
        aria-label={`Daily Tachyon tokens from ${fmt(days[0].day)} to ${fmt(days[days.length - 1].day)}, between ${Math.min(...days.map((d) => d.tokensM)).toFixed(1)} and ${peak.tokensM.toFixed(1)} million, peaking on ${fmt(peak.day)}.`}
        onMouseLeave={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W} y1={base - scale(t) + 0.5} y2={base - scale(t) + 0.5} style={{ stroke: 'var(--border)', strokeDasharray: t === 0 ? undefined : '2 3' }} />
            <text x={left - 6} y={base - scale(t) + 4} textAnchor="end" className={styles.axisLabel}>{t === 0 ? '0' : `${t}M`}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const h = scale(d.tokensM);
          const x = left + i * step + 1;
          return (
            <g key={d.day} onMouseEnter={() => setActive(i)}>
              <title>{`${fmt(d.day)}: ${d.tokensM.toFixed(1)}M tokens${d.weekend ? ' (weekend)' : ''}`}</title>
              <rect x={x - 1} y={top} width={step} height={base - top} fill="transparent" />
              <path
                d={barPath(x, base - h, bw, h, 3)}
                style={{ fill: 'var(--accent)', opacity: (d.weekend ? 0.32 : 1) * (active !== null && active !== i ? 0.6 : 1) }}
              />
              {d === peak && (
                <text x={x + bw / 2} y={base - h - 4} textAnchor="middle" className={styles.valueLabel}>{d.tokensM.toFixed(1)}M</text>
              )}
            </g>
          );
        })}
        {labelIdx.map((i) => (
          <text
            key={i}
            x={left + i * step + step / 2}
            y={H - 6}
            textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'}
            className={styles.axisLabel}
          >
            {fmt(days[i].day)}
          </text>
        ))}
      </svg>
      <div className={styles.legend}>
        <span><span className={styles.swatch} style={{ background: 'var(--accent)' }} />Weekday</span>
        <span><span className={styles.swatch} style={{ background: 'var(--accent)', opacity: 0.32 }} />Weekend</span>
      </div>
    </div>
  );
}

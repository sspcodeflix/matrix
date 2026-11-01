import type { ReactNode } from 'react';

/** Stroke icons from the design references (24x24 viewBox, currentColor). */
const paths: Record<string, ReactNode> = {
  acceptance: (<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v3H9z" /><path d="M9 13l2 2 4-4" /></>),
  regression: (<><path d="M20 11a8 8 0 0 0-14.9-3" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.9 3" /><path d="M20 20v-4h-4" /></>),
  journeys: (<><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>),
  review: (<><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M6 8.5v7" /><path d="M18 15.5V9a3 3 0 0 0-3-3h-4" /><path d="M13 4l-2 2 2 2" /></>),
  runs: <path d="M8 5v14l11-7z" />,
  huddle: (<><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 19c0-3 3-5 6-5s6 2 6 5" /><path d="M15 14c3 0 6 1.5 6 4.5" /></>),
  context: (<><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>),
  skills: (<><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></>),
  prompt: (<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3" /><path d="M12 15h5" /></>),
  stats: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>),
  lock: (<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  search: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  bell: (<><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  download: (<><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M5 20h14" /></>),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12l5 5 9-10" />,
  plus: <path d="M12 5v14M5 12h14" />,
  filter: <path d="M4 5h16l-6 8v5l-4 2v-7z" />,
  sort: <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />,
  sortAsc: <path d="M8 14l4-4 4 4" />,
  sortDesc: <path d="M8 10l4 4 4-4" />,
  external: (<><path d="M14 4h6v6" /><path d="M10 14L20 4" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>),
  git: (<><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="12" r="2.5" /><path d="M6 8.5v7" /><path d="M8.5 6H12a3 3 0 0 1 3 3v.5" /></>),
  upload: (<><path d="M12 20V9" /><path d="M7 14l5-5 5 5" /><path d="M5 4h14" /></>),
  warning: (<><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>),
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18, strokeWidth = 1.8, label }: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** Give a label only when the icon carries meaning on its own. */
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {paths[name]}
    </svg>
  );
}

export function MatrixLogo({ size = 24 }: { size?: number }) {
  const cells = [2, 11, 20];
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      {cells.flatMap((y) =>
        cells.map((x) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" rx="1" fill={x === 20 && y === 11 ? 'var(--accent)' : 'var(--text)'} />
        )),
      )}
    </svg>
  );
}

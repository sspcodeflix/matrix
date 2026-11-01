import { useLocation, useSearchParams } from 'react-router-dom';

/*
 * Cross-screen links that keep the work item's identity (UI_UX_REVIEW C3).
 *
 * - `item`: exact record ID (review item, Huddle decision) when the caller knows it.
 * - `ref`: the originating story or requirement ID (e.g. PAY-1490, FR-0233). The target
 *   resolves it to its own record and shows an explicit "nothing here yet" state when none
 *   exists; it never falls back to an unrelated record.
 * - `from`: the caller's path and query, so the target can offer "Back to …" with the
 *   original filters intact.
 */

export interface WorkLink {
  item?: string;
  ref?: string;
}

function build(path: string, link: WorkLink, from: string) {
  const q = new URLSearchParams();
  if (link.item) q.set('item', link.item);
  if (link.ref) q.set('ref', link.ref);
  q.set('from', from);
  return `${path}?${q.toString()}`;
}

/** Returns link builders that record the current location as the return path. */
export function useWorkLinks() {
  const { pathname, search } = useLocation();
  const from = pathname + search;
  return {
    review: (link: WorkLink) => build('/review', link, from),
    huddle: (link: WorkLink) => build('/huddle', link, from),
  };
}

const returnLabels: [prefix: string, label: string][] = [
  ['/acceptance', 'Acceptance'],
  ['/regression', 'Regression'],
  ['/review', 'Review queue'],
  ['/huddle', 'Huddle'],
  ['/runs', 'Runs'],
  ['/journeys', 'Journeys'],
];

/** Reads `item`, `ref` and a safe in-app return link from the current URL. */
export function useWorkTarget() {
  const [params] = useSearchParams();
  const raw = params.get('from');
  // Only same-app paths; never follow an absolute or protocol-relative URL.
  const from = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
  const label = from ? returnLabels.find(([p]) => from.startsWith(p))?.[1] ?? 'previous page' : null;
  return {
    item: params.get('item'),
    ref: params.get('ref'),
    back: from && label ? { to: from, label: `Back to ${label}` } : null,
  };
}

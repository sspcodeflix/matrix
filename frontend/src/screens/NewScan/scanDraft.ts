/*
 * The application-scoped scan draft shared by auto-discovery (/scans/new), Git (/scans/new/git)
 * and ZIP (/scans/new/zip). One draft per application holds every component with a stable ID,
 * its role, confirmations, removals (for undo), pinned versions and the review step, so switching
 * input method never swaps the list. Readiness is computed here once for all three screens.
 */

/** docs/DATA_MODEL.md `components`, plus the draft-only fields the scan setup needs. */
export type ComponentRole = 'source' | 'automation';
export type ComponentType = 'web' | 'api' | 'library' | 'automation';
export type ComponentOrigin = 'discovered' | 'git' | 'zip';
export type InputMode = 'auto' | 'git' | 'zip';
export type DraftStep = 'components' | 'review';

export interface ScanComponent {
  _id: string;
  name: string;
  role: ComponentRole;
  type: ComponentType;
  frameworks: string[];
  origin: ComponentOrigin;
  repoUrl?: string;
  /** Pinned branch or tag and the exact commit it resolved to. */
  ref?: string;
  commit?: string;
  zip?: { fileName: string; sha256: string };
  /** How discovery matched it; `confirmed: false` means the user must confirm it belongs to the app. */
  discovery?: { method: 'custom_property' | 'topic' | 'name'; value?: string; confirmed: boolean };
  /** False while Matrix's suggested role differs from what the user chose; the user must confirm it. */
  roleConfirmed: boolean;
  /** Non-blocking warning shown in the status column, e.g. an old commit. */
  warning?: string;
  /** Note under "Comes from", e.g. "added manually". */
  note?: string;
  /** Added from Git or ZIP during this draft (drives "just added" in the summary). */
  addedNow?: boolean;
}

export interface RemovedComponent {
  component: ScanComponent;
  /** Position in the list when it was removed, so undo puts it back in place. */
  index: number;
}

export interface ScanDraft {
  appId: string;
  /** Last input method used. */
  mode: InputMode;
  components: ScanComponent[];
  /** Removed components, most recent last. Discovery never re-adds these unless asked to. */
  removed: RemovedComponent[];
  /** True once discovery results were merged in; discovery seeds a draft only once. */
  discoverySeeded: boolean;
  step: DraftStep;
  startedScanId?: string;
  updatedAt: string;
}

export const emptyDraft = (appId: string, mode: InputMode = 'auto'): ScanDraft => ({
  appId,
  mode,
  components: [],
  removed: [],
  discoverySeeded: false,
  step: 'components',
  updatedAt: new Date().toISOString(),
});

/**
 * Canonical repository identity for duplicate detection: lower-case `host/owner/repo` without
 * scheme, credentials, `www.`, `.git`, trailing slash or `@branch`. Separate from the component
 * `_id`, which only identifies a draft row. Null when the URL has no owner and repository.
 */
export function repoIdentity(url: string): string | null {
  const m = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/\s]+@)?(?:www\.)?([^/\s:]+)(?::\d+)?\/+([^/\s]+)\/+([^/\s@]+?)(?:\.git)?\/*(?:@[^\s]*)?$/i.exec(url.trim());
  return m ? `${m[1]}/${m[2]}/${m[3]}`.toLowerCase() : null;
}

/**
 * Same component: same row, or the same repository by canonical identity. Same-named
 * repositories from different owners (team-a/shared-api, team-b/shared-api) are different.
 * Components without a repository URL (ZIP uploads) fall back to the name.
 */
export function sameComponent(a: ScanComponent, b: ScanComponent) {
  if (a._id === b._id) return true;
  const ra = a.repoUrl ? repoIdentity(a.repoUrl) : null;
  const rb = b.repoUrl ? repoIdentity(b.repoUrl) : null;
  if (ra && rb) return ra === rb;
  return a.name.toLowerCase() === b.name.toLowerCase();
}

/** `owner/repo` for repository components, so same-named repos are told apart; else the name. */
export function componentLabel(c: ScanComponent): string {
  const id = c.repoUrl ? repoIdentity(c.repoUrl) : null;
  return id ? id.slice(id.indexOf('/') + 1) : c.name;
}

let idCounter = 0;
/** Collision-free draft ID: crypto.randomUUID, else a clock plus a per-session counter. */
export function newId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : null;
  idCounter += 1;
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

// ---- Status and labels ---------------------------------------------------------------------

export const needsMembership = (c: ScanComponent) => c.discovery?.confirmed === false;
export const needsRole = (c: ScanComponent) => !c.roleConfirmed;

const TYPE_LABEL: Record<ComponentType, string> = { web: 'Web UI', api: 'API', library: 'Library', automation: 'Automation' };
const ORIGIN_LABEL: Record<ComponentOrigin, string> = { discovered: 'Discovered', git: 'Git link', zip: 'ZIP upload' };

export const typeLabel = (c: ScanComponent) => (c.frameworks.length ? c.frameworks.join(', ') : TYPE_LABEL[c.type]);
export const originLabel = (c: ScanComponent) => ORIGIN_LABEL[c.origin];
export const ORIGIN_OPTIONS = Object.values(ORIGIN_LABEL);
export const roleLabel = (r: ComponentRole) => (r === 'source' ? 'Source' : 'Automation');
export const versionLabel = (c: ScanComponent) =>
  c.origin === 'zip' ? `sha256 ${c.zip?.sha256 ?? '…'}` : `${c.ref ?? 'default'} @ ${c.commit ?? '…'}`;
export const originNote = (c: ScanComponent) => {
  if (c.origin === 'zip') return c.zip?.fileName ?? '';
  if (c.origin !== 'discovered') return c.note ?? 'added manually';
  switch (c.discovery?.method) {
    case 'custom_property': return `custom property ${c.discovery.value ?? ''}`.trim();
    case 'topic': return `topic ${c.discovery.value ?? ''}`.trim();
    default: return 'name match only';
  }
};

/** Filter value for the status column. */
export const statusLabel = (c: ScanComponent) =>
  needsMembership(c) ? 'Needs confirmation' : needsRole(c) ? 'Check the suggested role' : c.warning ? 'Warning' : 'Ready';
export const STATUS_OPTIONS = ['Ready', 'Needs confirmation', 'Check the suggested role', 'Warning'];
/** Text shown in the status column. */
export const statusText = (c: ScanComponent) =>
  needsMembership(c) ? 'Confirm it belongs to this app' : needsRole(c) ? 'Check the suggested role' : c.warning ?? 'Ready';
export const statusTone = (c: ScanComponent) =>
  needsMembership(c) || needsRole(c) ? 'var(--accent)' : c.warning ? 'var(--warning)' : 'var(--success)';

/** DOM ids of the row buttons the readiness note links to. */
export const membershipButtonId = (c: ScanComponent) => `confirm-${c._id}`;
export const roleButtonId = (c: ScanComponent) => `confirm-role-${c._id}`;

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Lists names as "a, b and c". */
export function listNames(names: string[]) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// ---- Readiness -----------------------------------------------------------------------------

export type Blocker =
  | { kind: 'empty' }
  | { kind: 'membership'; components: ScanComponent[] }
  | { kind: 'role'; components: ScanComponent[] }
  | { kind: 'no-source' }
  | { kind: 'no-automation' };

export interface Readiness {
  total: number;
  source: number;
  automation: number;
  discovered: number;
  manual: number;
  /** Every blocker, in the order the user should fix them. */
  blockers: Blocker[];
  /** The first blocker, shown beside Review and start. */
  blocker: Blocker | null;
}

/** The single readiness rule for the scan draft, used by discovery, Git and ZIP alike. */
export function readiness(components: ScanComponent[]): Readiness {
  const source = components.filter((c) => c.role === 'source').length;
  const discovered = components.filter((c) => c.origin === 'discovered').length;
  const membership = components.filter(needsMembership);
  const role = components.filter((c) => !needsMembership(c) && needsRole(c));
  const blockers: Blocker[] = [];
  if (components.length === 0) blockers.push({ kind: 'empty' });
  if (membership.length) blockers.push({ kind: 'membership', components: membership });
  if (role.length) blockers.push({ kind: 'role', components: role });
  if (components.length && source === 0) blockers.push({ kind: 'no-source' });
  if (components.length && components.length - source === 0) blockers.push({ kind: 'no-automation' });
  return {
    total: components.length,
    source,
    automation: components.length - source,
    discovered,
    manual: components.length - discovered,
    blockers,
    blocker: blockers[0] ?? null,
  };
}

export const summaryLine = (r: Readiness) => `${plural(r.total, 'component')} · ${r.source} source · ${r.automation} automation`;

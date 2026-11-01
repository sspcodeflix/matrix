import { newId, type ComponentRole, type ComponentType, type ScanComponent } from '../NewScan/scanDraft';

/*
 * Deterministic helpers for the manual scan batch. These stand in for the backend, which
 * clones the repo with the user's PAT (or unpacks the ZIP), pins the commit/hash and detects
 * frameworks from build files. TODO(backend): POST /api/apps/{appId}/scan-draft/components
 * returns the detected type, frameworks, commit and suggested role.
 */

export interface ParsedRepo {
  line: string;
  url: string;
  name: string;
  branch?: string;
}

const REPO_LINE = /^(https?:\/\/[^\s/]+\/[^\s/]+\/([A-Za-z0-9._-]+?))(?:\.git)?\/?(?:@([^\s@]+))?$/;

export function parseRepoLines(text: string): { valid: ParsedRepo[]; invalid: string[] } {
  const valid: ParsedRepo[] = [];
  const invalid: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = REPO_LINE.exec(line);
    if (!m) invalid.push(line);
    else valid.push({ line, url: m[1], name: m[2], branch: m[3] });
  }
  return { valid, invalid };
}

/** Short stable pseudo-hash so the mock shows a pinned version. */
export function pseudoHash(seed: string, length = 7): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let out = '';
  for (let i = 0; i < length; i++) {
    h = Math.imul(h ^ (h >>> 13), 2654435761);
    out += ((h >>> 0) % 16).toString(16);
  }
  return out;
}

/** Name-based stand-in for framework detection. */
export function detect(name: string): { role: ComponentRole; type: ComponentType; frameworks: string[] } {
  const n = name.toLowerCase();
  if (/karate|contract/.test(n)) return { role: 'automation', type: 'automation', frameworks: ['Karate'] };
  if (/test|automation|qa|e2e|selenium/.test(n)) return { role: 'automation', type: 'automation', frameworks: ['Selenium'] };
  if (/ui|portal|web|frontend/.test(n)) return { role: 'source', type: 'web', frameworks: [] };
  if (/lib|common|sdk/.test(n)) return { role: 'source', type: 'library', frameworks: [] };
  return { role: 'source', type: 'api', frameworks: [] };
}

/**
 * Build a component from a batch item. When detection disagrees with the role the user chose
 * for the batch, Matrix uses its suggestion but asks the user to confirm it.
 */
export function makeComponent(
  base: Omit<ScanComponent, '_id' | 'role' | 'type' | 'frameworks' | 'roleConfirmed'>,
  chosenRole: ComponentRole,
): ScanComponent {
  const d = detect(base.name);
  const suggested = d.role !== chosenRole;
  return {
    ...base,
    _id: newId(`cmp-${base.name}`),
    role: d.role,
    type: d.type,
    frameworks: d.frameworks,
    roleConfirmed: !suggested,
    note: suggested ? `${base.note ?? 'just added'} · role suggested` : base.note,
    addedNow: true,
  };
}

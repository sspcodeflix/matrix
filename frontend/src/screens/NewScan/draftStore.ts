import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { discardScanDraft, loadScanDraft, saveScanDraft } from './api';
import {
  emptyDraft, sameComponent,
  type DraftStep, type InputMode, type ScanComponent, type ScanDraft,
} from './scanDraft';

/*
 * One scan draft per application, shared by discovery, Git and ZIP. Load order: in-memory, then
 * sessionStorage (survives a refresh), then the backend. Every change writes sessionStorage at
 * once and saves to the backend after a short pause.
 */

const drafts = new Map<string, ScanDraft>();
const errors = new Map<string, Error>();
const loading = new Set<string>();
const listeners = new Set<() => void>();
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SAVE_DELAY_MS = 600;
const MAX_UNDO = 20;

const storageKey = (appId: string) => `matrix.scanDraft.${appId}`;

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function readSession(appId: string): ScanDraft | null {
  try {
    const raw = sessionStorage.getItem(storageKey(appId));
    if (!raw) return null;
    const d = JSON.parse(raw) as ScanDraft;
    return d && d.appId === appId && Array.isArray(d.components) && Array.isArray(d.removed) ? d : null;
  } catch {
    return null;
  }
}

function writeSession(d: ScanDraft) {
  try {
    sessionStorage.setItem(storageKey(d.appId), JSON.stringify(d));
  } catch {
    // Storage blocked or full: the in-memory draft and the backend save still work.
  }
}

function clearSession(appId: string) {
  try {
    sessionStorage.removeItem(storageKey(appId));
  } catch {
    // Ignore blocked storage.
  }
}

function scheduleSave(d: ScanDraft) {
  clearTimeout(saveTimers.get(d.appId));
  saveTimers.set(
    d.appId,
    setTimeout(() => {
      saveTimers.delete(d.appId);
      const latest = drafts.get(d.appId);
      if (latest) void saveScanDraft(latest);
    }, SAVE_DELAY_MS),
  );
}

function commit(d: ScanDraft, { toServer = true } = {}) {
  drafts.set(d.appId, d);
  writeSession(d);
  if (toServer) scheduleSave(d);
  emit();
}

function ensureLoaded(appId: string) {
  if (drafts.has(appId) || loading.has(appId)) return;
  const local = readSession(appId);
  if (local) {
    // TODO(backend): compare with the server copy's updatedAt and keep the newer one.
    drafts.set(appId, local);
    emit();
    return;
  }
  loading.add(appId);
  errors.delete(appId);
  loadScanDraft(appId).then(
    (saved) => {
      loading.delete(appId);
      if (!drafts.has(appId)) commit(saved ?? emptyDraft(appId), { toServer: false });
    },
    (err: Error) => {
      loading.delete(appId);
      errors.set(appId, err);
      emit();
    },
  );
}

function mutate(appId: string, fn: (d: ScanDraft) => ScanDraft) {
  const current = drafts.get(appId);
  if (!current) return;
  commit({ ...fn(current), updatedAt: new Date().toISOString() });
}

function draftActions(appId: string) {
  const get = () => drafts.get(appId);
  const setComponents = (fn: (list: ScanComponent[]) => ScanComponent[]) =>
    mutate(appId, (d) => ({ ...d, components: fn(d.components) }));

  return {
    setMode: (mode: InputMode) => mutate(appId, (d) => (d.mode === mode ? d : { ...d, mode })),
    setStep: (step: DraftStep) => mutate(appId, (d) => ({ ...d, step })),

    /** Merge discovery results once per draft. Removed components and ones already present are skipped. */
    seedFromDiscovery: (found: ScanComponent[]) =>
      mutate(appId, (d) => {
        if (d.discoverySeeded) return d;
        const skip = [...d.components, ...d.removed.map((r) => r.component)];
        const fresh = found.filter((c) => !skip.some((x) => sameComponent(x, c)));
        return { ...d, discoverySeeded: true, components: [...fresh, ...d.components] };
      }),

    /** "Run discovery again": re-add discovered components that were removed. Returns their names. */
    rediscover: (found: ScanComponent[]) => {
      const d = get();
      if (!d) return [];
      const missing = found.filter((c) => !d.components.some((x) => sameComponent(x, c)));
      if (!missing.length) return [];
      const order = found.map((c) => c._id);
      const pos = (c: ScanComponent) => {
        const i = order.indexOf(c._id);
        return i < 0 ? order.length : i;
      };
      // Discovered ones keep discovery order; components added from Git or ZIP stay after them.
      const restored = missing.map((c) => d.removed.find((r) => sameComponent(r.component, c))?.component ?? c);
      mutate(appId, (cur) => ({
        ...cur,
        components: [...cur.components, ...restored].sort((a, b) => pos(a) - pos(b)),
        removed: cur.removed.filter((r) => !missing.some((c) => sameComponent(r.component, c))),
      }));
      return missing.map((c) => c.name);
    },

    add: (items: ScanComponent[]) => setComponents((list) => [...list, ...items]),
    update: (id: string, changes: Partial<ScanComponent>) =>
      setComponents((list) => list.map((c) => (c._id === id ? { ...c, ...changes } : c))),
    confirmMembership: (id: string) =>
      setComponents((list) => list.map((c) => (c._id === id && c.discovery ? { ...c, discovery: { ...c.discovery, confirmed: true } } : c))),
    confirmRole: (id: string) => setComponents((list) => list.map((c) => (c._id === id ? { ...c, roleConfirmed: true } : c))),

    remove: (id: string) =>
      mutate(appId, (d) => {
        const index = d.components.findIndex((c) => c._id === id);
        if (index < 0) return d;
        return {
          ...d,
          components: d.components.filter((c) => c._id !== id),
          removed: [...d.removed, { component: d.components[index], index }].slice(-MAX_UNDO),
        };
      }),

    /** Put the most recently removed component back where it was. Returns it, if any. */
    undoRemove: () => {
      const last = get()?.removed.slice(-1)[0];
      if (!last) return null;
      mutate(appId, (d) => {
        const components = [...d.components];
        components.splice(Math.min(last.index, components.length), 0, last.component);
        return { ...d, components, removed: d.removed.slice(0, -1) };
      });
      return last.component;
    },

    markStarted: (scanId: string) => mutate(appId, (d) => ({ ...d, startedScanId: scanId })),

    /** Throw the draft away everywhere and start a fresh one (discovery seeds it again). */
    discard: () => {
      const mode = get()?.mode ?? 'auto';
      clearTimeout(saveTimers.get(appId));
      saveTimers.delete(appId);
      clearSession(appId);
      void discardScanDraft(appId);
      commit(emptyDraft(appId, mode), { toServer: false });
    },
  };
}

export type ScanDraftActions = ReturnType<typeof draftActions>;

export interface ScanDraftStore {
  draft: ScanDraft | null;
  error: Error | undefined;
  actions: ScanDraftActions;
}

/** The scan draft for one application. `draft` is null while it loads. */
export function useScanDraft(appId: string): ScanDraftStore {
  const draft = useSyncExternalStore(subscribe, () => drafts.get(appId) ?? null);
  const error = useSyncExternalStore(subscribe, () => errors.get(appId));
  useEffect(() => ensureLoaded(appId), [appId]);
  const actions = useMemo(() => draftActions(appId), [appId]);
  return { draft, error, actions };
}

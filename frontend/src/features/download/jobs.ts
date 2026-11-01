import { useSyncExternalStore } from 'react';
import { fetchRecentExports, type ExportJob, type ExportJobState } from './api';
import type { ReportFormat, ScopeKey } from './types';

/*
 * Export job store. Lives at module level so jobs keep running and stay listed when the
 * dialog closes and reopens (docs/REPORTS.md, "Shared download journey" step 5).
 *
 * Generation is simulated locally with timers. TODO(backend):
 *   POST   /api/exports                      create (idempotency key = dedupe key; none when null), returns job
 *   GET    /api/exports?requester=me         history (or SSE/poll for status changes)
 *   POST   /api/exports/{id}/cancel          cancel while queued/generating
 *   POST   /api/exports/{id}/retry           re-render from the captured snapshot
 *   POST   /api/exports/{id}/regenerate      original snapshot, new artifact
 *   GET    /api/exports/{id}/file            authenticated download (access rechecked)
 */

// TODO(OPEN_QUESTIONS #16): retention, size limits and classification label come from configuration.
export const ILLUSTRATIVE_RETENTION_DAYS = 7;

export interface JobStoreState {
  jobs: ExportJob[];
  /** Latest status message, announced through an aria-live region. */
  message: string;
  loaded: boolean;
}

let state: JobStoreState = { jobs: [], message: 'Choose a report, or reuse a saved snapshot below.', loaded: false };
let sequence = 50;
let loading = false;
const listeners = new Set<() => void>();
const timers = new Map<string, number[]>();

function set(next: Partial<JobStoreState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function patch(id: string, changes: Partial<ExportJob>, message?: string) {
  set({
    jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...changes } : j)),
    ...(message !== undefined ? { message } : {}),
  });
}

const find = (id: string) => state.jobs.find((j) => j.id === id);

export function useExportJobs(): JobStoreState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function ensureJobsLoaded() {
  if (state.loaded || loading) return;
  loading = true;
  fetchRecentExports().then((seed) => {
    const known = new Set(state.jobs.map((j) => j.id));
    const seeded = seed.filter((j) => !known.has(j.id)).map((j) => ({ ...j, dedupeKey: j.dedupeKey ?? dedupeKeyFor(jobIdentity(j)) }));
    set({ jobs: [...state.jobs, ...seeded], loaded: true });
    seed.filter((j) => j.state === 'Queued' || j.state === 'Generating').forEach((j) => simulate(j.id, 6000));
  });
}

/** Simulated worker: Queued -> Generating -> Ready. No percentage: progress is not measurable. */
function simulate(id: string, renderMs = 3200) {
  clearTimers(id);
  const t1 = window.setTimeout(() => {
    const job = find(id);
    if (job?.state === 'Queued') patch(id, { state: 'Generating' }, `${job.id} ${job.title} (${job.format.toUpperCase()}) is generating.`);
  }, 700);
  const t2 = window.setTimeout(() => {
    const job = find(id);
    if (job?.state !== 'Generating' && job?.state !== 'Queued') return;
    const done = new Date();
    patch(
      id,
      {
        state: 'Ready',
        sizeKb: job.sizeKb ?? 40 + Math.round(Math.random() * 300),
        expiresAt: new Date(done.getTime() + ILLUSTRATIVE_RETENTION_DAYS * 86_400_000).toISOString(),
      },
      `${job.id} ${job.title} (${job.format.toUpperCase()}) is ready to download.`,
    );
    timers.delete(id);
  }, renderMs);
  timers.set(id, [t1, t2]);
}

function clearTimers(id: string) {
  timers.get(id)?.forEach((t) => window.clearTimeout(t));
  timers.delete(id);
}

/** Compact UTC stamp, e.g. 20261101T094200Z. Offsets (e.g. +04:00) are converted to UTC first. */
export const utcStamp = (iso: string) => {
  const t = new Date(iso);
  const utcIso = Number.isNaN(t.getTime()) ? iso : t.toISOString();
  return utcIso.replace(/[-:]/g, '').replace(/\.\d+/, '').replace(/Z?$/, 'Z');
};

export const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'report';

/**
 * Deterministic filename: matrix_<app>_<report-type>_<scope-id>_<captured-UTC>_<report-id>.<ext>.
 * The timestamp is the source capture time, never the export time. `undefined` renders the
 * template placeholder (preview before a capture time is known); `null` means the capture time
 * is unknown and is spelled out rather than replaced with the current time.
 */
export function buildFilename(app: string, reportKey: string, snapshotId: string, capturedAt: string | null | undefined, id: string, format: ReportFormat) {
  const stamp = capturedAt ? utcStamp(capturedAt) : capturedAt === null ? 'capture-time-unknown' : '<captured-UTC>';
  return `matrix_${slug(app)}_${slug(reportKey)}_${snapshotId.replace(/[^A-Za-z0-9-]/g, '')}_${stamp}_${id}.${format}`;
}

export interface ExportInput {
  reportKey: string;
  title: string;
  format: ReportFormat;
  formats: ReportFormat[];
  context: string;
  application: string;
  scopeKey: ScopeKey | 'original';
  scopeLabel: string;
  /** Display metadata only; never part of the export identity. */
  count: number;
  /** Selected record IDs (scope `selected`). Required for de-duplication of that scope. */
  ids?: string[];
  /** Normalized filter spec (scope `filtered`). Required for de-duplication of that scope. */
  spec?: string;
  snapshotId: string;
  /** Source capture time of the pinned snapshot; null when the screen did not supply it. */
  capturedAt: string | null;
  requester: string;
}

type IdentityFields = Pick<ExportInput, 'context' | 'application' | 'reportKey' | 'format' | 'scopeKey' | 'snapshotId' | 'capturedAt' | 'requester' | 'ids' | 'spec'>;

/**
 * Export identity (UI_UX_REVIEW C2): application, invoking context, report, format, scope kind,
 * snapshot (ID and capture time), the record identity of the scope and the requester. The record count is not part of
 * it. Returns null when a subset scope has no record identity: such requests are never
 * deduplicated, because equal counts cannot prove equal records.
 */
export function dedupeKeyFor(i: IdentityFields): string | null {
  let records: string;
  if (i.scopeKey === 'full') records = '*';
  else if (i.scopeKey === 'selected' && i.ids && i.ids.length > 0) records = `ids:${[...new Set(i.ids)].sort().join(',')}`;
  else if (i.scopeKey === 'filtered' && i.spec !== undefined) records = `spec:${i.spec}`;
  else return null;
  return JSON.stringify([i.application, i.context, i.reportKey, i.format, i.scopeKey, i.snapshotId, i.capturedAt ?? 'capture-unknown', records, i.requester]);
}

const jobIdentity = (j: ExportJob): IdentityFields => ({
  context: j.context, application: j.application, reportKey: j.reportKey, format: j.format, scopeKey: j.scopeKey,
  snapshotId: j.snapshotId, capturedAt: j.capturedAt, requester: j.requester, ids: j.scopeIds, spec: j.scopeSpec,
});

/**
 * Create an export, or return the existing pending/ready job with the same identity
 * (never matched by title or count alone).
 */
export function requestExport(input: ExportInput, note?: string): { job: ExportJob; duplicate: boolean } {
  const dedupeKey = dedupeKeyFor(input);
  const existing = dedupeKey
    ? state.jobs.find((j) => j.dedupeKey === dedupeKey && ['Queued', 'Generating', 'Ready'].includes(j.state))
    : undefined;
  if (existing) {
    set({ message: `Existing ${existing.state.toLowerCase()} export ${existing.id} selected. No duplicate job was created.` });
    return { job: existing, duplicate: true };
  }
  const now = new Date().toISOString();
  const id = `RPT-${String(++sequence).padStart(3, '0')}`;
  const job: ExportJob = {
    id,
    dedupeKey,
    reportKey: input.reportKey,
    title: input.title,
    format: input.format,
    formats: input.formats,
    context: input.context,
    application: input.application,
    scopeKey: input.scopeKey,
    scopeLabel: input.scopeLabel,
    count: input.count,
    ...(input.ids ? { scopeIds: [...input.ids].sort() } : {}),
    ...(input.spec !== undefined ? { scopeSpec: input.spec } : {}),
    snapshotId: input.snapshotId,
    // Never substitute the current time: null is shown as "capture time unknown".
    capturedAt: input.capturedAt,
    createdAt: now,
    state: 'Queued',
    filename: buildFilename(input.application, input.reportKey, input.snapshotId, input.capturedAt, id, input.format),
    snapshotRetained: true,
    requester: input.requester,
  };
  set({ jobs: [job, ...state.jobs], message: note ? `Export ${id} queued. ${note}` : `Export ${id} queued from snapshot ${input.snapshotId}.` });
  simulate(id);
  return { job, duplicate: false };
}

export function cancelExport(id: string) {
  const job = find(id);
  if (!job || (job.state !== 'Queued' && job.state !== 'Generating')) return;
  clearTimers(id);
  patch(id, { state: 'Cancelled' }, `Export ${id} cancelled. Its captured snapshot is retained, so you can retry it.`);
}

/** Re-render from the captured snapshot: same job, same records, same capture time. */
export function retryExport(id: string) {
  const job = find(id);
  if (!job || !job.snapshotRetained) return;
  patch(id, { state: 'Queued', error: undefined, createdAt: new Date().toISOString() }, `Export ${id} queued again from snapshot ${job.snapshotId}.`);
  simulate(id);
}

/** Expired: a new artifact from the original captured snapshot (same records and capture time). */
export function regenerateOriginal(id: string, requester: string) {
  const job = find(id);
  if (!job || !job.snapshotRetained) return;
  return requestExport({ ...fromJob(job), requester });
}

/**
 * Expired: a new report from current data. A fresh snapshot is captured, so it gets a new
 * snapshot ID and a new capture time; the same record identity (ids/spec) is re-applied.
 */
export function createUpdated(id: string, requester: string) {
  const job = find(id);
  if (!job) return;
  // TODO(backend): the capture time comes from the snapshot service when the fresh capture completes.
  const capturedAt = new Date().toISOString();
  const stamp = utcStamp(capturedAt).slice(0, 13);
  const snapshotId = `${job.snapshotId}-U${stamp.slice(4)}`;
  return requestExport(
    { ...fromJob(job), requester, snapshotId, capturedAt },
    `New capture ${snapshotId} of current data (data as of ${capturedAt.slice(0, 16).replace('T', ' ')} UTC); snapshot ${job.snapshotId} stays unchanged.`,
  );
}

/** Ready: a companion format from the same captured snapshot (same records and capture time; never recaptured). */
export function companionExport(id: string, format: ReportFormat, requester: string) {
  const job = find(id);
  if (!job) return;
  return requestExport({ ...fromJob(job), format, requester });
}

export function downloadExport(id: string) {
  const job = find(id);
  if (!job || job.state !== 'Ready') return;
  // TODO(backend): GET /api/exports/{id}/file through the authenticated app; access is rechecked.
  // Delivery does not mean the file was opened, approved or imported anywhere.
  set({ message: `Download of ${job.filename} requested. Simulated: no file is produced until the export service exists.` });
}

function fromJob(job: ExportJob): ExportInput {
  return {
    reportKey: job.reportKey,
    title: job.title,
    format: job.format,
    formats: job.formats,
    context: job.context,
    application: job.application,
    scopeKey: job.scopeKey,
    scopeLabel: job.scopeLabel,
    count: job.count,
    ids: job.scopeIds,
    spec: job.scopeSpec,
    snapshotId: job.snapshotId,
    capturedAt: job.capturedAt,
    requester: job.requester,
  };
}

export type { ExportJob, ExportJobState };

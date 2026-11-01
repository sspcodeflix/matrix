export type ReportFormat = 'pdf' | 'html' | 'xlsx' | 'csv';

/** The three explicit export scopes (docs/REPORTS.md, "Shared download journey"). */
export type ScopeKey = 'selected' | 'filtered' | 'full';

export interface ReportTypeOption {
  key: string;
  label: string;
  description: string;
  /** Formats this report supports (docs/REPORTS.md catalogue). */
  formats: ReportFormat[];
  /**
   * Optional per-report scope counts, for reports that count a different unit than the
   * screen (e.g. test cases mapped to the selected stories). Merged over `request.scope`.
   */
  scope?: Partial<DownloadRequest['scope']>;
  /** Optional "Records" preview text per scope, e.g. "11 gaps in scope: 7 no test, 4 not automated". */
  records?: Partial<Record<ScopeKey, string>>;
  /** Optional "Sections" preview text, e.g. "Summary, gaps by type and module, traceability". */
  sections?: string;
  /** Optional eligible/excluded summary with reasons, for gated outputs. */
  exclusions?: string;
  /** Optional per-format hint override, e.g. { xlsx: 'Summary, Test cases, Steps and Sources sheets' }. */
  formatNotes?: Partial<Record<ReportFormat, string>>;
}

export interface ScopeCount {
  count: number;
  /** Unit with plural, e.g. { one: 'gap', many: 'gaps' }. Report units must be explicit. */
  unit: { one: string; many: string };
  /** Optional hint under the scope option, e.g. "Every page, not just the 6 rows shown". */
  hint?: string;
  /**
   * Identity of the records in this scope (UI_UX_REVIEW C2). For `selected`, the stable
   * record IDs; for `filtered`, a normalized filter spec (see `filterSpec`). Used for
   * de-duplication; the count stays display metadata.
   */
  ids?: string[];
  spec?: string;
  /** Option title override, e.g. "This run · #4821" instead of "Selected rows (1 run)". */
  label?: string;
  /**
   * Snapshot for this scope when it differs from the request's (e.g. one run versus a
   * collection of runs), so scope, snapshot and filename describe the same evidence.
   */
  snapshot?: { id: string; text: string; capturedAt?: string };
}

/** Normalized, order-independent filter spec, e.g. "q=refund;status=No test;view=gaps". */
export function filterSpec(filters: Record<string, string | null | undefined>): string {
  return Object.entries(filters)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${String(v).trim().toLowerCase()}`)
    .sort()
    .join(';');
}

/** What the invoking screen passes when it opens the shared Download report dialog. */
export interface DownloadRequest {
  /** Dialog title, e.g. "Download report" or "Download test cases". */
  title?: string;
  /** Invoking context, e.g. "Regression · Payments Hub · Release 26.11". */
  context: string;
  reportTypes: ReportTypeOption[];
  defaultReportType?: string;
  scope: {
    /** Omit or count 0 when the screen has no selection; the option is then disabled. */
    selected?: ScopeCount;
    filtered: ScopeCount;
    full: ScopeCount;
  };
  /** Snapshot pinned for the export, e.g. "Scan S-022 · data as of today 09:42". */
  snapshot: string;
  /** Active filters in words, e.g. "View: Gaps · Repo: pay-hub-automation@main". */
  filters?: string;
  /** Optional whole-scope figure, always labelled separately from subset totals. */
  comparison?: string;
  /** Optional application name for the deterministic filename; defaults to the session application. */
  applicationName?: string;
  /**
   * When the pinned source data was captured (ISO 8601), distinct from when the export is
   * created (UI_UX_REVIEW C6). Shown as "data as of" for every format and retry.
   */
  snapshotCapturedAt?: string;
  /** Optional stable snapshot ID for the filename and de-duplication, e.g. "S-022". Derived from `snapshot` when omitted. */
  snapshotId?: string;
  /** Optional reason shown when Selected rows is disabled, e.g. "Select rows in the gaps table to use this". */
  selectionHint?: string;
}

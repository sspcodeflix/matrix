// Reference: design/html/Workspace.html
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import type { Application } from '../../api/session';
import { DataTable, type Column, type TableView } from '../../components/DataTable';
import { Icon } from '../../components/Icon';
import { DownloadButton, ErrorState, Loading, Pill, type PillTone } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec } from '../../features/download/types';
import { useWorkLinks } from '../../navigation';
import { useWorkspace } from '../../workspace/useWorkspace';
import {
  decideOverride, fetchRegression, requestAutomation, resyncSources,
  type PipelineStep, type RegressionData, type RequirementRow, type StepOwner,
} from './api';
import { CoverageBars, TierCounts } from '../Overview/charts';
import { measures, stateOf, summarize, tierCounts, type CoverageState, type Decision } from './coverage';
import styles from './Regression.module.css';

const TABLE_ID = 'gaps';

const stateInfo: Record<CoverageState, { label: string; tone: PillTone }> = {
  no_test: { label: 'No test', tone: 'accent' },
  stale: { label: 'Stale coverage', tone: 'warning' },
  awaiting: { label: 'Awaiting execution evidence', tone: 'warning' },
  cases_only: { label: 'Cases only', tone: 'neutral' },
  override_pending: { label: 'Override pending', tone: 'outline' },
  excluded: { label: 'Out of scope', tone: 'neutral' },
  covered: { label: 'Automated and passing', tone: 'success' },
};

function gapSummary(rows: RequirementRow[], decision: Decision | null, runId: string) {
  const s = summarize(rows, decision, runId);
  const parts = [`${s.noTest} no test`, `${s.casesOnly} cases only`, `${s.awaiting} awaiting execution evidence`, `${s.stale} stale`];
  const excluded = s.excluded ? `; ${s.excluded} excluded as out of scope` : '';
  return `${plural(s.gaps, 'gap')} in ${plural(s.total, 'requirement')}: ${parts.join(', ')}${excluded}`;
}

/** The single row action rule. Bulk "Write automation" takes exactly the rows whose action is `write`. */
type RowActionKind =
  | { kind: 'write'; label: string }
  | { kind: 'review'; label: string; item?: string; reason: string }
  | { kind: 'huddle'; label: string; item?: string; reason: string }
  | { kind: 'evidence'; label: string; reason: string }
  | { kind: 'requested'; reason: string }
  | { kind: 'excluded'; reason: string }
  | { kind: 'none' };

function rowAction(r: RequirementRow, decision: Decision | null, requested: boolean, runId: string): RowActionKind {
  const m = measures(r, decision, runId);
  if (m.excluded) return { kind: 'excluded', reason: 'out of scope (accepted override)' };
  if (requested) return { kind: 'requested', reason: 'automation already requested' };
  if (m.overridePending) return { kind: 'huddle', label: 'Review in Huddle', item: r.decisionId, reason: 'override waiting for a Huddle decision' };
  if (r.reviewId && !m.covered) {
    return { kind: 'review', label: r.reviewPr ? `Review PR #${r.reviewPr}` : 'Review changes', item: r.reviewId, reason: `already in review${r.reviewPr ? ` in PR #${r.reviewPr}` : ''}` };
  }
  if (m.stale) return { kind: 'review', label: 'Review diff', reason: 'stale coverage: review the diff first' };
  if (m.awaiting) {
    const why = r.lastRun ? `no mapped test passed in run #${runId}` : `not yet executed in run #${runId}`;
    return { kind: 'evidence', label: 'View run', reason: `automated; ${why}` };
  }
  if (m.noTest) return { kind: 'write', label: 'Write automation' };
  if (m.casesOnly) return { kind: 'write', label: 'Generate' };
  return { kind: 'none' };
}

const OWNER_LABEL: Record<StepOwner, string> = {
  matrix: 'Matrix working',
  qa: 'Needs QA',
  uat: 'Needs UAT',
  external: 'Waiting on Git/Harness',
};
const OWNER_DONE: Record<StepOwner, string> = {
  matrix: 'Done by Matrix',
  qa: 'Done by QA',
  uat: 'Done by UAT',
  external: 'Done in Git/Harness',
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function octaneText(r: RequirementRow) {
  if (r.octaneCases === 0) return '0 cases';
  return `${plural(r.octaneCases, 'case')}${r.octaneStale ? ', stale' : ''}`;
}
function automationText(r: RequirementRow, runId: string) {
  if (r.scripts === 0) return 'none';
  const run = !r.lastRun
    ? `not run in #${runId}`
    : r.lastRun.runId !== runId ? `last run #${r.lastRun.runId}, not this scan's`
    : r.lastRun.passed ? `passed in #${runId}` : `failed in #${runId}`;
  return `${plural(r.scripts, 'script')}${r.scriptsStale ? ', stale' : ''} · ${run}`;
}

export default function RegressionScreen() {
  const [params, setParams] = useSearchParams();
  const { application, applications, selectApplication } = useWorkspace();
  // Drill-down links (e.g. from the Overview) carry `?app=`. Switch the workspace context to that
  // application, keeping its stored workspace preference, then drop the parameter so the
  // sidebar and workspace switcher stay in charge. Never fall back to another application.
  const requested = params.get('app');
  const target = requested ? applications.find((a) => a.id === requested) : application;
  useEffect(() => {
    if (!requested || !target) return;
    selectApplication(target.id);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('app');
      return next;
    }, { replace: true });
  }, [requested, target, selectApplication, setParams]);

  if (!target) return <UnknownApp appId={requested ?? ''} current={application} />;
  return <RegressionLoader key={target.id} app={target} />;
}

function RegressionLoader({ app }: { app: Application }) {
  const { data, error, loading } = useApi(() => fetchRegression(app.id), [app.id]);
  if (error) return <ErrorState error={error} />;
  if (loading || data === undefined) return <Loading label={`Loading regression for ${app.name}`} />;
  if (data === null) return <NoScan app={app} />;
  return <Regression data={data} app={app} />;
}

/** The application has no completed regression scan: say so, never show another application. */
function NoScan({ app }: { app: Application }) {
  return (
    <div className="page">
      <h1>Regression · {app.name}</h1>
      <section className="card card-pad stack" aria-labelledby="no-scan" style={{ '--gap': '12px', maxWidth: 720 } as CSSProperties}>
        <h2 id="no-scan" style={{ fontSize: 16 }}>No regression scan for {app.name} yet</h2>
        <p className="secondary">
          Coverage for <span className="mono">{app.id}</span> appears here after its first completed scan. A scan reads the
          application's requirements, Octane test cases and automation repositories, and saves a snapshot that Compare
          scans and the Overview use.
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Link className="btn primary" to="/scans/new">New scan for {app.name}</Link>
          <Link className="btn" to="/overview">Back to Overview</Link>
        </div>
      </section>
    </div>
  );
}

/** A drill-down named an application that is not in the user's Matrix applications. */
function UnknownApp({ appId, current }: { appId: string; current: Application }) {
  return (
    <div className="page">
      <h1>Regression · <span className="mono">{appId || 'unknown application'}</span></h1>
      <section className="card card-pad stack" role="alert" style={{ '--gap': '12px', maxWidth: 720 } as CSSProperties}>
        <h2 style={{ fontSize: 16 }}>{appId ? <><span className="mono">{appId}</span> is not set up in Matrix for you</> : 'No application given'}</h2>
        <p className="secondary">
          The portfolio overview can list applications you cannot open in Matrix. Matrix has no regression workspace for
          this one in your account, so it shows nothing rather than another application's coverage. Ask a Matrix admin to
          add the application or give you access.
        </p>
        {/* TODO(backend): entitlement check; OPEN_QUESTIONS multi-app access. */}
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Link className="btn" to="/overview">Back to Overview</Link>
          <Link className="btn" to="/regression">Open Regression for {current.name}</Link>
        </div>
      </section>
    </div>
  );
}

function Regression({ data, app }: { data: RegressionData; app: Application }) {
  const download = useDownloadReport();
  const links = useWorkLinks();
  const [params] = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [filtered, setFiltered] = useState<RequirementRow[]>([]);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [decision, setDecision] = useState<Decision | null>(null);
  const [message, setMessage] = useState<{ text: string; jobId?: string } | null>(null);
  const [resyncing, setResyncing] = useState(false);
  const [resyncedAt, setResyncedAt] = useState<string | null>(null);

  // Regression is application-level. A workspace chosen at the top right shows a labelled subset:
  // requirements with tests in that workspace plus gaps not yet assigned to any (docs/METRICS.md).
  const { current } = useWorkspace();
  // Only a workspace of this application narrows it (the context can lag one render behind a drill-down).
  const workspace = current && current.appId === app.id ? current : null;
  const scopeLabel = workspace ? `${workspace.id} (subset)` : 'whole application';
  const rows = useMemo(
    () => (workspace ? data.requirements.filter((r) => r.workspaceIds.length === 0 || r.workspaceIds.includes(workspace.id)) : data.requirements),
    [data.requirements, workspace],
  );
  const { lastRun, huddle } = data;
  const runId = lastRun.runId;
  const sum = summarize(rows, decision, runId);
  /** Whole-application figures, always labelled separately from a workspace subset. */
  const appSum = summarize(data.requirements, decision, runId);
  const runTotal = lastRun.passed + lastRun.failed;
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  const excludedRows = rows.filter((r) => measures(r, decision, runId).excluded);
  const coverageLine = (s: typeof sum) =>
    `${s.covered} of ${s.inScope} in-scope requirements automated and passing in run #${runId} (${pct(s.covered, s.inScope)}%)${s.excluded ? `, ${s.excluded} excluded` : ''}`;

  // Bulk generation scope: the selection when there is one, otherwise every gap. Eligible rows are
  // exactly those whose row action is `write`; the rest are listed with their reason.
  const selectedSet = new Set(selected);
  const scopeRows = selected.length ? rows.filter((r) => selectedSet.has(r.frId)) : rows.filter((r) => measures(r, decision, runId).gap);
  const scoped = scopeRows.map((r) => ({ r, a: rowAction(r, decision, requested.has(r.frId), runId) }));
  const targets = scoped.filter((x) => x.a.kind === 'write').map((x) => x.r);
  const blocked = scoped.filter((x) => x.a.kind !== 'write' && x.a.kind !== 'none');
  const writeLabel = selected.length
    ? `Write automation for ${plural(targets.length, 'selected gap')}`
    : `Write automation for all ${plural(targets.length, 'eligible gap')}`;

  // The next action follows the pipeline's current stage.
  const currentStep = data.steps.find((s) => s.state !== 'done');
  const reviewStep = currentStep?.state === 'review' && currentStep.review ? currentStep : undefined;
  // The pipeline is application-wide; in a subset, say whether the next review is inside it.
  const reviewRef = reviewStep?.review?.ref;
  const reviewScope = !workspace || !reviewRef
    ? null
    : rows.some((r) => r.frId === reviewRef)
      ? `${reviewRef} is in ${scopeLabel}`
      : `${reviewRef} is outside ${scopeLabel}: whole-application work`;

  const queue = async (frIds: string[]) => {
    if (!frIds.length) return;
    setRequested((prev) => new Set([...prev, ...frIds]));
    const text = `Automation requested for ${plural(frIds.length, 'gap')} (${frIds.join(', ')}). Matrix opens a pull request on a matrix/* branch for review; nothing runs until a person merges it.`;
    setMessage({ text });
    const res = await requestAutomation(frIds);
    setMessage({ text, jobId: res.jobId });
  };

  const decide = (d: Decision) => {
    if (!huddle) return;
    setDecision(d);
    void decideOverride(huddle.decisionId, d);
  };

  const resync = () => {
    setResyncing(true);
    resyncSources().then(() => {
      setResyncing(false);
      setResyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    });
  };

  const views: TableView<RequirementRow>[] = useMemo(
    () => [
      { key: 'gaps', label: 'Gaps', match: (r) => measures(r, decision, runId).gap },
      { key: 'all', label: 'All', match: () => true },
      { key: 'no-test', label: 'No test', match: (r) => measures(r, decision, runId).noTest },
      { key: 'cases-only', label: 'Cases only', match: (r) => measures(r, decision, runId).casesOnly },
      { key: 'awaiting', label: 'Awaiting evidence or stale', match: (r) => measures(r, decision, runId).awaitingOrStale },
      { key: 'passing', label: 'Automated and passing', match: (r) => measures(r, decision, runId).covered },
      { key: 'overrides', label: 'Overrides', match: (r) => r.status === 'override' },
    ],
    [decision, runId],
  );

  const columns: Column<RequirementRow>[] = useMemo(
    () => [
      { key: 'fr', header: 'FR', value: (r) => r.frId, mono: true, width: 110 },
      { key: 'req', header: 'Requirement', value: (r) => r.title, render: (r) => <span className={styles.reqTitle}>{r.title}</span> },
      { key: 'module', header: 'Module', value: (r) => r.module, filter: { type: 'select' } },
      {
        key: 'workspace', header: 'Workspaces', mono: true,
        value: (r) => (r.workspaceIds.length ? r.workspaceIds.join(', ') : 'Not assigned'),
        filter: { type: 'text' },
      },
      {
        key: 'octane', header: 'Octane', value: (r) => octaneText(r),
        render: (r) => <span className={r.octaneCases === 0 ? styles.warnText : undefined}>{octaneText(r)}</span>,
        filter: { type: 'text' },
      },
      { key: 'automation', header: 'Automation', value: (r) => automationText(r, runId), filter: { type: 'text' } },
      {
        key: 'status', header: 'Status',
        value: (r) => stateInfo[stateOf(r, decision, runId)].label,
        render: (r) => {
          const info = stateInfo[stateOf(r, decision, runId)];
          return <Pill tone={info.tone}>{info.label}</Pill>;
        },
        filter: { type: 'select', options: Object.values(stateInfo).map((s) => s.label) },
      },
      {
        key: 'action', header: 'Action', sortable: false, filter: { type: 'none' }, value: () => '',
        render: (r) => <RowAction row={r} action={rowAction(r, decision, requested.has(r.frId), runId)} onQueue={queue} links={links} />,
      },
    ],
    [decision, requested, links, runId],
  );

  // URL filter state (keyword, view, column filters) is the filtered scope's identity.
  const filterState = () => {
    const state: Record<string, string | null> = {
      q: params.get(`${TABLE_ID}.q`),
      view: params.get(`${TABLE_ID}.view`) ?? views[0].key,
      override: huddle && decision ? `${huddle.decisionId}:${decision}` : null,
      // The workspace subset is part of the filtered scope's identity.
      app: app.id,
      workspace: workspace?.id ?? null,
    };
    for (const c of columns) state[`f.${c.key}`] = params.get(`${TABLE_ID}.f.${c.key}`);
    return state;
  };

  const describeFilters = () => {
    const parts: string[] = [`Scope: ${workspace ? scopeLabel : 'Whole application'}`];
    const view = views.find((v) => v.key === params.get(`${TABLE_ID}.view`)) ?? views[0];
    parts.push(`View: ${view.label}`);
    const q = params.get(`${TABLE_ID}.q`);
    if (q) parts.push(`Keyword: "${q}"`);
    for (const c of columns) {
      const v = params.get(`${TABLE_ID}.f.${c.key}`);
      if (v) parts.push(`${c.header}: ${v}`);
    }
    parts.push(`Repo: ${data.repo}`);
    return parts.join(' · ');
  };

  const openDownload = () => {
    const unit = { one: 'requirement', many: 'requirements' };
    const filteredCases = filtered.reduce((n, r) => n + r.octaneCases, 0);
    const selectedRows = rows.filter((r) => selectedSet.has(r.frId));
    const exclusions = excludedRows.length
      ? `${plural(excludedRows.length, 'requirement')} excluded from gaps and automation totals: ${excludedRows.map((r) => r.frId).join(', ')} out of scope for ${huddle?.release ?? 'this release'} (accepted Huddle override${huddle ? ` ${huddle.decisionId}` : ''}).`
      : undefined;
    download.open({
      title: 'Download report',
      context: `Regression · ${app.name} · ${scopeLabel}`,
      applicationName: app.name,
      reportTypes: [
        {
          key: 'coverage',
          label: 'Coverage and gaps',
          description: 'Scope, coverage numerator and denominator, gaps by type and module, stale evidence, requirement-to-test traceability.',
          formats: ['pdf', 'html', 'xlsx'],
          records: {
            selected: selectedRows.length ? gapSummary(selectedRows, decision, runId) : undefined,
            filtered: gapSummary(filtered, decision, runId),
            full: `${workspace ? `${scopeLabel}: ` : ''}${gapSummary(rows, decision, runId)}`,
          },
          exclusions,
        },
        {
          key: 'test-cases',
          label: 'Test cases',
          description: `Linked test cases for the chosen requirements (one requirement can map to several test cases; the current filters map to ${plural(filteredCases, 'Octane test case')}).`,
          formats: ['xlsx'],
        },
      ],
      defaultReportType: 'coverage',
      scope: {
        selected: { count: selected.length, unit, ids: [...selected].sort() },
        filtered: { count: filtered.length, unit, spec: filterSpec(filterState()) },
        full: { count: sum.total, unit, hint: workspace ? `Every requirement in ${scopeLabel}, not the whole application` : undefined },
      },
      snapshot: `Scan ${data.scanId} · data as of ${data.scanAsOf}`,
      snapshotId: data.scanId,
      snapshotCapturedAt: data.scanCapturedAt,
      filters: describeFilters(),
      comparison: workspace
        ? `${scopeLabel}: ${coverageLine(sum)}. Whole application: ${coverageLine(appSum)}`
        : `Whole application: ${coverageLine(appSum)}`,
      selectionHint: 'Select rows in the gaps table to use this',
    });
  };

  const stepsDone = data.steps.filter((s) => s.state === 'done').length;
  const reviewIndex = data.steps.findIndex((s) => s.state === 'review');
  const stepLink = (s: PipelineStep) =>
    s.review ? { label: s.review.label, to: links.review({ item: s.review.item, ref: s.review.ref }) } : s.link;

  const excludedNote = excludedRows.length
    ? `${excludedRows.map((r) => r.frId).join(', ')} excluded: out of scope for ${huddle?.release ?? 'this release'}`
    : sum.overridePending
      ? `${plural(sum.overridePending, 'override')} pending in Huddle, still counted as a gap`
      : huddle && decision === 'rejected'
        ? `Override rejected: ${huddle.frId} stays a gap`
        : 'No out-of-scope overrides';

  return (
    <div className="page">
      <div className="stack" style={{ '--gap': '16px' } as CSSProperties}>
        <div className="stack" style={{ '--gap': '6px' } as CSSProperties}>
          <h1>Regression · {app.name} · {scopeLabel}</h1>
          <span className="secondary" style={{ fontSize: 13 }}>
            {workspace
              ? `Requirements with tests in ${workspace.id}, plus gaps not yet assigned to a workspace. Application totals are on the whole-application view.`
              : data.scopeNote}{' '}
            · last scan {data.scanAsOf}
          </span>
        </div>
        <div className={styles.headActions}>
          {reviewStep?.review && (
            <Link className="btn primary" to={links.review({ item: reviewStep.review.item, ref: reviewStep.review.ref })}>
              Review generated changes<span className="sr-only"> ({reviewStep.review.label}{reviewScope ? `; ${reviewScope}` : ''})</span>
            </Link>
          )}
          <button
            type="button"
            className={reviewStep ? 'btn' : 'btn primary'}
            disabled={targets.length === 0}
            aria-describedby="write-scope"
            onClick={() => queue(targets.map((r) => r.frId))}
          >
            {writeLabel}
          </button>
          <DownloadButton onClick={openDownload} />
          <Link className="btn" to="/regression/compare">Compare scans</Link>
          <Link className="btn" to="/scans/new">New scan</Link>
        </div>
        {reviewScope && (
          <p className={`small ${styles.scopeNote}`}>
            <Pill tone="neutral">{scopeLabel}</Pill> Next review: {reviewStep?.review?.label}. {reviewScope}.
          </p>
        )}
        <p id="write-scope" className={`small muted ${styles.scopeNote}`}>
          {targets.length === 0 && (selected.length ? 'None of the selected rows can be generated. ' : 'No gap is eligible for generation. ')}
          {blocked.length > 0
            ? `Not included: ${blocked.map((x) => `${x.r.frId} (${'reason' in x.a ? x.a.reason : ''})`).join('; ')}.`
            : selected.length ? '' : 'Select rows to limit generation to specific gaps.'}
        </p>
        {message && (
          <div className="banner success" role="status">
            <Icon name="check" size={16} />
            <span>
              {message.text}
              {message.jobId && (
                <>
                  {' '}Job <span className="mono">{message.jobId}</span>.{' '}
                  <Link to={`/processing?workflow=regression&job=${encodeURIComponent(message.jobId)}`}>View progress</Link>
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* One coverage summary with the Overview's tiers; secondary counts sit beneath it. */}
      <section aria-labelledby="coverage-heading" className={`card ${styles.coverage}`}>
        <div className={styles.covMain}>
          <h2 id="coverage-heading" className="stat-label">Functional coverage · {workspace ? scopeLabel : 'whole application'}</h2>
          <span className="stat-value" style={{ color: 'var(--success-text)' }}>{pct(sum.covered, sum.inScope)}%</span>
          <span className="small secondary">
            {sum.covered} of {sum.inScope} in-scope requirements automated and passing in run #{runId}
          </span>
          {workspace && (
            <span className="small muted">Whole application: {appSum.covered} of {appSum.inScope} ({pct(appSum.covered, appSum.inScope)}%)</span>
          )}
        </div>
        <div className={styles.covTiers}>
          <CoverageBars
            rows={[{ id: app.id, label: workspace ? workspace.label : app.name, sublabel: workspace ? 'subset' : 'whole application', counts: tierCounts(sum) }]}
            caption={`Coverage tiers for ${app.name}, ${scopeLabel}`}
          />
          <TierCounts counts={tierCounts(sum)} />
        </div>
        <dl className={styles.covSecondary}>
          <div><dt>Requirements mapped</dt><dd>{sum.total} <span className="muted">· {data.requirementsSource}</span></dd></div>
          <div>
            <dt>Overrides</dt>
            <dd>{sum.excluded + sum.overridePending} <span className="muted">· {excludedNote}</span></dd>
          </div>
          <div>
            <dt>Last run pass rate</dt>
            <dd>
              {pct(lastRun.passed, runTotal)}% <span className="muted">· {lastRun.passed} of {runTotal} tests · Harness on HyperExecute #{runId} · {lastRun.when}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="pipeline-heading" className="card">
        <div className={styles.pipeHead}>
          <div className={styles.pipeHeadLeft}>
            <h2 id="pipeline-heading" style={{ fontSize: 16 }}>Regression pipeline</h2>
            {workspace && <Pill tone="neutral">Whole application, not only {scopeLabel}</Pill>}
            <Link className={styles.previewLink} to="/processing?workflow=regression">Preview processing controls</Link>
            <span className="secondary" style={{ fontSize: 13 }}>
              {stepsDone} of {data.steps.length} steps complete · {data.pipelineStarted}
            </span>
          </div>
          {reviewIndex >= 0 && (
            <span className={styles.attentionNote}>
              <span className="dot" style={{ background: 'var(--accent)' }} aria-hidden="true" />
              Needs your review at step {reviewIndex + 1}
            </span>
          )}
        </div>
        {/* Wide: all stages in order. */}
        <ol className={`${styles.pipe} ${styles.pipeWide}`}>
          {data.steps.map((s, i) => <Step key={s.key} step={s} index={i} link={stepLink(s)} />)}
        </ol>
        {/* Narrow (<700px): current and upcoming stages first, completed stages in an expandable history. */}
        <div className={styles.pipeNarrow}>
          <ol className={styles.pipeNarrowList}>
            {data.steps.map((s, i) => (s.state === 'done' ? null : <Step key={s.key} step={s} index={i} link={stepLink(s)} />))}
          </ol>
          {stepsDone > 0 && (
            <details className={styles.history}>
              <summary>Completed stages ({stepsDone})</summary>
              <ol className={styles.pipeNarrowList}>
                {data.steps.map((s, i) => (s.state === 'done' ? <Step key={s.key} step={s} index={i} link={stepLink(s)} /> : null))}
              </ol>
            </details>
          )}
        </div>
      </section>

      <div id={TABLE_ID} className={styles.tableWrap}>
        <DataTable
          id={TABLE_ID}
          title={<h2 id="gaps-heading" style={{ fontSize: 16 }}>Functional gaps</h2>}
          rows={rows}
          columns={columns}
          rowKey={(r) => r.frId}
          rowLabel={(r) => r.frId}
          views={views}
          selectable
          onSelectionChange={setSelected}
          onFilteredChange={setFiltered}
          searchLabel="Search gaps"
          searchPlaceholder="Search by keyword, FR id, requirement or module"
          pageSizes={[6, 25, 50]}
          noun={{ one: 'requirement', many: 'requirements' }}
          minWidth={980}
        />
      </div>

      <div className={styles.bottom}>
        <section aria-labelledby="sources-heading" className={`card ${styles.sideCard}`}>
          <div className={styles.sideHead}>
            <h2 id="sources-heading">Sources</h2>
            <button type="button" className={`btn ${styles.smallBtn}`} onClick={resync} disabled={resyncing}>
              {resyncing ? 'Resyncing…' : 'Resync'}
            </button>
          </div>
          <ul className={styles.sources}>
            {data.sources.map((s) => (
              <li key={s.name}>
                <span className="dot" style={{ background: s.health === 'ok' ? 'var(--success)' : 'var(--accent)' }} aria-hidden="true" />
                {s.to ? <Link to={s.to}>{s.name}</Link> : <span style={{ fontWeight: 500 }}>{s.name}</span>}
                <span className="sr-only">{s.health === 'ok' ? '(healthy)' : '(needs attention)'}</span>
                <span className={styles.srcDetail}>{s.detail}</span>
              </li>
            ))}
          </ul>
          <span className="small muted" role="status">
            {resyncedAt ? `Resync requested at ${resyncedAt}. Counts refresh when the sources report back.` : ''}
          </span>
        </section>

        <section aria-labelledby="huddle-heading" className={`card ${styles.sideCard}`}>
          <div className={styles.sideHead}>
            <h2 id="huddle-heading">Huddle</h2>
            {huddle && (
              <div className={styles.avatars} aria-label={`${huddle.participants.length} participants`}>
                {huddle.participants.map((p) => <span key={p} className={styles.avatar}>{p}</span>)}
              </div>
            )}
          </div>
          {huddle ? (
            <div className={styles.override}>
              <span className={styles.overrideTag}>
                {decision ? `Override ${decision}` : '1 override pending your review'}
              </span>
              <p style={{ fontSize: 13, lineHeight: 1.5 }}>
                <span className="mono secondary">{huddle.frId}</span> marked out of scope for {huddle.release} by{' '}
                {huddle.proposedBy}, {huddle.proposedAgo}. Reason: {huddle.reason}
              </p>
              <div className="row" role="status">
                {decision ? (
                  <span className="small secondary" style={{ flex: 1 }}>
                    {decision === 'accepted'
                      ? `You accepted the override. ${huddle.frId} is out of scope for ${huddle.release}: it is no longer counted in gaps, Not automated or the coverage denominator, and is listed under Overrides.`
                      : `You rejected the override. ${huddle.frId} stays a gap for ${huddle.release} and can be generated.`}{' '}
                    <button type="button" className="link-btn" onClick={() => setDecision(null)}>Undo</button>
                  </span>
                ) : (
                  <>
                    <button type="button" className="btn dark" onClick={() => decide('accepted')}>Accept</button>
                    <button type="button" className="btn" onClick={() => decide('rejected')}>Reject</button>
                  </>
                )}
                <Link to={links.huddle({ item: huddle.decisionId, ref: huddle.frId })} style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
                  Open in Huddle
                </Link>
              </div>
            </div>
          ) : (
            <p className="small muted">No decisions waiting for you.</p>
          )}
        </section>

        <section aria-labelledby="run-heading" className={`card ${styles.sideCard}`}>
          <div className={styles.sideHead}>
            <h2 id="run-heading">Last run</h2>
            <span className="mono small muted">HyperExecute #{lastRun.runId}</span>
          </div>
          <div className={styles.runStats}>
            <div className={`${styles.runStat} ${styles.runPass}`}><strong>{lastRun.passed}</strong><span>passed</span></div>
            <div className={`${styles.runStat} ${styles.runFail}`}><strong>{lastRun.failed}</strong><span>failed</span></div>
            <div className={styles.runStat}><strong>{lastRun.duration}</strong><span>duration</span></div>
          </div>
          <p style={{ fontSize: 13 }} className="secondary">
            Branch <span className="mono">{lastRun.branch}</span>, {lastRun.when}.{' '}
            {lastRun.octaneUpload === 'uploaded' ? 'Results uploaded to Octane.' : 'Results not yet uploaded to Octane.'}
          </p>
          <div className="row" style={{ '--gap': '16px' } as CSSProperties}>
            <Link to={`/runs?run=${lastRun.runId}`} style={{ fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>View run</Link>
            {/* TODO(integration): deep link to the MLflow trace for this run. */}
            <a href="#" style={{ fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Trace in MLflow</a>
          </div>
        </section>
      </div>
    </div>
  );
}

function RowAction({ row, action, onQueue, links }: {
  row: RequirementRow;
  action: RowActionKind;
  onQueue: (frIds: string[]) => void;
  links: ReturnType<typeof useWorkLinks>;
}) {
  switch (action.kind) {
    case 'write':
      return (
        <button type="button" className={styles.actionLink} onClick={() => onQueue([row.frId])}>
          {action.label}<span className="sr-only"> for {row.frId}</span>
        </button>
      );
    case 'review':
      return (
        <Link className={styles.actionLink} to={links.review({ item: action.item, ref: row.frId })}>
          {action.label}<span className="sr-only"> for {row.frId}</span>
        </Link>
      );
    case 'huddle':
      return (
        <Link className={styles.actionLink} to={links.huddle({ item: action.item, ref: row.frId })}>
          {action.label}<span className="sr-only"> for {row.frId}</span>
        </Link>
      );
    case 'evidence':
      return (
        <Link className={styles.actionLink} to={`/runs?run=${row.lastRun?.runId ?? ''}`} title={action.reason}>
          {action.label}<span className="sr-only"> for {row.frId}: {action.reason}</span>
        </Link>
      );
    case 'requested':
      return <span className="small muted">Requested</span>;
    case 'excluded':
      return <span className="small muted">Excluded: out of scope</span>;
    default:
      return <span className="muted" aria-label="No action">—</span>;
  }
}

function Step({ step, index, link }: { step: PipelineStep; index: number; link: PipelineStep['link'] }) {
  const cls = step.state === 'done' ? styles.done : step.state === 'review' ? styles.review : '';
  const badge = { done: 'Done', review: 'Review needed', queued: 'Queued', running: 'Running' }[step.state];
  const owner = step.state === 'done' ? OWNER_DONE[step.owner] : OWNER_LABEL[step.owner];
  return (
    <li className={`${styles.step} ${cls}`} aria-current={step.state === 'review' ? 'step' : undefined}>
      <span className={styles.bar} aria-hidden="true" />
      <div className="spread" style={{ gap: 8 }}>
        <span className={styles.stepNo}>STEP {String(index + 1).padStart(2, '0')}</span>
        <span className={styles.stepBadge}>
          {step.state === 'done' && <Icon name="check" size={12} strokeWidth={2.4} />}
          {badge}
        </span>
      </div>
      <h3 style={{ fontSize: 16 }}>{step.name}</h3>
      <span className={styles.owner}>{owner}</span>
      <p className={styles.stepSummary}>{step.summary}</p>
      <details className={styles.evidence}>
        <summary>Details</summary>
        <span className={styles.stepTools}>{step.tools}</span>
      </details>
      {link ? (
        link.to.startsWith('#') ? (
          <a className={styles.stepLink} href={link.to}>{link.label}</a>
        ) : (
          <Link className={styles.stepLink} to={link.to}>{link.label}</Link>
        )
      ) : (
        <span className={styles.stepWait}>{step.waitingNote}</span>
      )}
    </li>
  );
}

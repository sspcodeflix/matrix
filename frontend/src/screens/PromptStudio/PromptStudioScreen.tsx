// Reference: design/html/PromptStudio.html
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useApi } from '../../api/useApi';
import { DataTable, type Column } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { DownloadButton, ErrorState, Loading } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec } from '../../features/download/types';
import { fetchPromptStudio, type Check, type DiffLine, type DraftRow, type InstructionLayer, type PromptStudioData } from './api';
import { changeCount, lineDiff, shortHash } from './promptUtils';
import styles from './PromptStudio.module.css';

interface SampleRun {
  id: string;
  sampleId: string;
  baseline: string;
  revision: number;
  agoLabel: string;
  /** When the run finished (ISO 8601): capture time of its evidence for exports. */
  ranAt: string;
  mlflowRunId: string;
  saved: boolean;
}

interface EvalRun {
  revision: number;
  hash: string;
  passed: number;
  cases: number;
  datasetVersion: string;
  ranAt: string;
}

type ResultTab = 'checks' | 'output' | 'tools';

const draftUnit = { one: 'draft', many: 'drafts' };

export default function PromptStudioScreen() {
  const { data, error, loading } = useApi(fetchPromptStudio);
  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <Loading label="Loading prompt studio" />;
  return <PromptStudio data={data} />;
}

function Chevron() {
  return (
    <svg className={styles.chev} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
    </svg>
  );
}

function ReadyIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8" /></svg>
  );
}

function DiffBlock({ lines, label }: { lines: DiffLine[]; label: string }) {
  return (
    <pre className={styles.diff} aria-label={label}>
      {lines.map((d, i) => (
        <span key={i} className={d.op === 'add' ? styles.add : styles.del}>
          <span className="sr-only">{d.op === 'add' ? 'Added: ' : 'Removed: '}</span>
          {d.op === 'add' ? '+ ' : '- '}
          {d.text}
        </span>
      ))}
    </pre>
  );
}

function PromptStudio({ data }: { data: PromptStudioData }) {
  const download = useDownloadReport();
  const currentDraftLayer = data.layers.find((l) => l.draft?.id === data.currentDraftId);
  const editable = data.layers.filter((l) => l.kind !== 'policy');

  const initialTexts = useMemo(
    () => Object.fromEntries(editable.map((l) => [l.id, l.draft?.text ?? l.liveText])) as Record<string, string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );
  const [texts, setTexts] = useState<Record<string, string>>(initialTexts);
  const [savedLabels, setSavedLabels] = useState<Record<string, string>>(
    () => Object.fromEntries(editable.filter((l) => l.draft).map((l) => [l.id, l.draft!.savedLabel])),
  );
  const [open, setOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(data.layers.map((l) => [l.id, !!l.draft || l.kind === 'session'])),
  );
  const [revision, setRevision] = useState(currentDraftLayer?.draft?.revision ?? 1);

  const [sampleId, setSampleId] = useState(data.lastRun.sampleId);
  const [baseline, setBaseline] = useState(data.lastRun.baseline);
  const [run, setRun] = useState<SampleRun | null>({ ...data.lastRun, revision: data.lastRun.draftRevision, saved: false });
  const [runSeq, setRunSeq] = useState(() => Number(data.lastRun.id.replace(/\D/g, '')) || 0);
  const [runningSample, setRunningSample] = useState(false);
  const [extraSampleRuns, setExtraSampleRuns] = useState(0);
  const [evalRun, setEvalRun] = useState<EvalRun | null>(null);
  const [evalProgress, setEvalProgress] = useState<number | null>(null);
  const [pr, setPr] = useState<{ number: number; branch: string; revision: number } | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>('checks');
  const [dialog, setDialog] = useState<'assembled' | 'scope' | 'pr' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filteredDrafts, setFilteredDrafts] = useState<string[]>(() => data.drafts.map((d) => d.id));
  const [edited, setEdited] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const runEvalsRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ----- derived state ----- */
  const skillLayers = editable.filter((l) => l.kind !== 'session');
  const diffs = Object.fromEntries(skillLayers.map((l) => [l.id, lineDiff(l.liveText, texts[l.id] ?? '')])) as Record<string, DiffLine[]>;
  const changedLayers = skillLayers.filter((l) => diffs[l.id].length > 0);
  const sessionText = texts.session ?? '';
  const differs = changedLayers.length > 0;
  const draftHash = shortHash(editable.map((l) => texts[l.id] ?? '').join('\u0000'));
  const sample = data.samples.find((s) => s.id === (run?.sampleId ?? sampleId)) ?? data.samples[0];
  const runStale = !!run && run.revision !== revision;
  const runDraftChecks: Check[] = run ? (differs || sessionText ? sample.draftChecks : sample.baselineChecks) : [];
  const samplePasses = !!run && !runStale && runDraftChecks.every((c) => c.pass);
  const evalStale = !!evalRun && evalRun.revision !== revision;
  const evalsCurrent = !!evalRun && !evalStale;
  const evalPassRate = evalRun ? Math.round((evalRun.passed / evalRun.cases) * 100) : 0;
  const prOpen = !!pr && pr.revision === revision;
  const canOpenPr = differs && samplePasses && evalsCurrent && !prOpen;
  const liveLabel = currentDraftLayer?.liveVersion ?? 'live';
  const baselineLayer = currentDraftLayer ?? skillLayers[0];

  const initialLen = data.layers.reduce((n, l) => n + (l.kind === 'policy' ? l.liveText.length : initialTexts[l.id]?.length ?? 0), 0);
  const currentLen = data.layers.reduce((n, l) => n + (l.kind === 'policy' ? l.liveText.length : texts[l.id]?.length ?? 0), 0);
  const assembledTokens = Math.max(0, data.assembledTokens + Math.round((currentLen - initialLen) / 4));

  /* ----- editing ----- */
  const bumpIfEvaluated = () => {
    const evaluated = run?.revision === revision || evalRun?.revision === revision || pr?.revision === revision;
    if (evaluated) setRevision((r) => r + 1);
  };
  const editLayer = (id: string, value: string) => {
    bumpIfEvaluated();
    setTexts((t) => ({ ...t, [id]: value }));
    // TODO(backend): PUT /api/prompt-drafts/{id} (debounced autosave; new revision and contentHash).
    setSavedLabels((s) => ({ ...s, [id]: 'just now' }));
    setEdited(true);
  };
  const discard = () => {
    bumpIfEvaluated();
    setTexts(Object.fromEntries(editable.map((l) => [l.id, l.liveText])));
    setSavedLabels({});
    setEdited(true);
    setNotice('Draft discarded. All layers match the live versions again.');
  };

  /* ----- simulated runs ----- */
  useEffect(() => {
    if (!runningSample) return;
    const t = setTimeout(() => {
      const next = runSeq + 1;
      setRunSeq(next);
      // TODO(backend): POST /api/prompt-runs { draftId, draftRevision, sampleId, baseline } runs in the sandbox (scratch branch, no PR).
      setRun({ id: `PS-${String(next).padStart(4, '0')}`, sampleId, baseline, revision, agoLabel: 'just now', ranAt: new Date().toISOString(), mlflowRunId: `mlf-${next.toString(16)}`, saved: false });
      setExtraSampleRuns((n) => n + 1);
      setRunningSample(false);
      setResultTab('checks');
    }, 1100);
    return () => clearTimeout(t);
  }, [runningSample, runSeq, sampleId, baseline, revision]);

  useEffect(() => {
    if (evalProgress === null) return;
    if (evalProgress >= data.dataset.cases) {
      // TODO(backend): POST /api/prompt-runs { evaluationScope: "full_dataset", datasetId, datasetVersion }.
      setEvalRun({ revision, hash: draftHash, passed: Math.min(data.mockEval.passed, data.dataset.cases), cases: data.dataset.cases, datasetVersion: data.dataset.version, ranAt: new Date().toISOString() });
      setEvalProgress(null);
      return;
    }
    const t = setTimeout(() => setEvalProgress((p) => (p === null ? null : Math.min(data.dataset.cases, p + 3))), 120);
    return () => clearTimeout(t);
  }, [evalProgress, data.dataset, data.mockEval.passed, revision, draftHash]);

  // An edit during an eval run invalidates it.
  useEffect(() => {
    if (evalProgress !== null && edited) setEvalProgress(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts]);

  const focusRunEvals = () => {
    runEvalsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    runEvalsRef.current?.focus({ preventScroll: true });
  };

  const openPr = () => {
    const number = data.mockNextPrNumber; // TODO(backend): real PR number from GitHub.
    const branch = `matrix/prompt-${data.currentDraftId.toLowerCase()}-r${revision}`;
    setPr({ number, branch, revision });
    setDialog(null);
    setNotice(`Pull request opened on matrix-skills from ${branch}. It goes live only after a person merges it and evals pass the gate in Skills.`);
  };

  /* ----- drafts table ----- */
  const draftRows = useMemo<DraftRow[]>(
    () =>
      data.drafts.map((d) =>
        d.id !== data.currentDraftId
          ? d
          : {
              ...d,
              sampleRuns: d.sampleRuns + extraSampleRuns,
              evalPassRate: evalsCurrent ? evalPassRate : d.evalPassRate,
              updatedLabel: edited ? 'just now' : d.updatedLabel,
              updatedMinutes: edited ? 0 : d.updatedMinutes,
              status: prOpen ? 'pr_open' : d.status,
              prNumber: prOpen ? pr?.number : d.prNumber,
            },
      ),
    [data, extraSampleRuns, evalsCurrent, evalPassRate, edited, prOpen, pr],
  );

  const columns = useMemo<Column<DraftRow>[]>(
    () => [
      {
        key: 'draft', header: 'Draft', value: (d) => `${d.id} ${d.subject}`,
        render: (d) => (
          <span className="stack" style={{ '--gap': '2px' } as CSSProperties}>
            <span className="row" style={{ '--gap': '6px' } as CSSProperties}>
              <span className="mono" style={{ fontWeight: 500 }}>{d.id}</span>
              {d.id === data.currentDraftId && <span className="chip tone-accent">open here</span>}
            </span>
            <span className="small muted">{d.subject}</span>
          </span>
        ),
      },
      { key: 'layer', header: 'Layer', value: (d) => d.layer, filter: { type: 'select' } },
      { key: 'base', header: 'Based on', value: (d) => d.baseVersion ?? 'None', render: (d) => (d.baseVersion ? <span className="mono">{d.baseVersion}</span> : <span className="muted">None</span>) },
      { key: 'author', header: 'Author', value: (d) => (d.author === data.currentUser ? `${d.author} (you)` : d.author) },
      { key: 'runs', header: 'Sample runs', value: (d) => d.sampleRuns },
      {
        key: 'evals', header: 'Evals', filter: { type: 'select' },
        value: (d) => (d.evalPassRate === null ? 'Not run' : d.evalPassRate >= data.gate ? 'At or above gate' : 'Below gate'),
        render: (d) =>
          d.evalPassRate === null ? <span className="pill">Not run</span>
          : d.evalPassRate >= data.gate ? <span className="pill tone-success">{d.evalPassRate}%</span>
          : <span className="pill tone-accent">{d.evalPassRate}% · below gate</span>,
      },
      { key: 'updated', header: 'Updated', value: (d) => d.updatedMinutes, filter: { type: 'none' }, render: (d) => d.updatedLabel },
      {
        key: 'status', header: 'Status', filter: { type: 'select' },
        value: (d) => ({ editing: 'Editing', needs_work: 'Needs work', pr_open: 'PR open', promoted: 'Promoted', session_only: 'Session only' })[d.status],
        render: (d) =>
          d.status === 'pr_open' ? <a href="#" /* TODO: GitHub PR URL from prompt_drafts.prUrl */>PR #{d.prNumber} open</a>
          : d.status === 'editing' ? <span className="pill tone-warning">Editing</span>
          : d.status === 'needs_work' ? <span className="pill tone-accent">Needs work</span>
          : d.status === 'promoted' ? <span className="pill tone-success">Promoted</span>
          : <span className="pill">Session only</span>,
      },
    ],
    [data],
  );

  const openDownload = () =>
    download.open({
      context: `Prompt studio · ${data.scope.appName} · ${data.currentDraftId}`,
      reportTypes: [
        {
          key: 'prompt-eval',
          label: 'Prompt evaluation',
          description: 'Draft revision and hash, baseline commit, dataset/sample version, checks, token use and MLflow references. Sample and full-dataset results are labelled separately.',
          formats: ['pdf', 'html', 'xlsx'],
        },
      ],
      scope: {
        selected: { count: 1, unit: draftUnit, ids: [data.currentDraftId] },
        filtered: { count: filteredDrafts.length, unit: draftUnit, spec: filterSpec({ rows: [...filteredDrafts].sort().join(',') }) },
        full: { count: draftRows.length, unit: draftUnit },
      },
      snapshot: [
        run ? `Sample run ${run.id} on rev ${run.revision}${runStale ? ' (stale)' : ''}` : 'No sample run',
        evalRun ? `full dataset ${evalRun.datasetVersion} on rev ${evalRun.revision}${evalStale ? ' (stale)' : ''}` : 'full dataset not run',
        `draft hash ${draftHash}`,
      ].join(' · '),
      // Capture time of the newest evidence (sample run or full-dataset eval); unknown when neither has run.
      snapshotCapturedAt: [run?.ranAt, evalRun?.ranAt].filter((t): t is string => !!t).sort().pop(),
      comparison: `Baseline ${baseline} @ ${baselineLayer?.liveCommit ?? ''} · promotion gate ${data.gate}% (in Skills)`,
    });

  const readiness = [
    { ok: differs, label: differs ? `Draft differs from ${liveLabel}` : `Draft matches ${liveLabel}` },
    { ok: samplePasses, label: !run ? 'Sample run not done' : runStale ? 'Sample run is from an earlier revision' : samplePasses ? 'Sample run passes' : 'Sample run has failing checks' },
    {
      ok: evalsCurrent,
      label: evalsCurrent ? `Golden dataset evals run · ${evalPassRate}%` : evalStale ? 'Golden dataset evals are stale' : 'Golden dataset evals not run',
      action: !evalsCurrent,
    },
  ];

  return (
    <div className="page" style={{ gap: 20 }}>
      <div className="spread" style={{ alignItems: 'flex-end', gap: 16 }}>
        <div className="stack" style={{ '--gap': '6px', maxWidth: 720 } as CSSProperties}>
          <h1>Prompt studio</h1>
          <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
            Try changes to the system instruction on a sample task and compare the result with the live version. Drafts never reach live runs. To keep a change,
            open a PR on matrix-skills; it goes live only after evals pass the gate in Skills.
          </span>
        </div>
        <div className={styles.headActions}>
          <div className="row">
            <button type="button" className="btn" disabled={!differs && !sessionText} onClick={discard}>Discard draft</button>
            <button type="button" className="btn" disabled={!canOpenPr} aria-describedby="pr-readiness" aria-haspopup="dialog" onClick={() => setDialog('pr')}>
              {prOpen ? `PR #${pr!.number} open` : 'Open PR on matrix-skills'}
            </button>
          </div>
          <ul className={styles.ready} id="pr-readiness" aria-label="Ready to open a PR">
            {readiness.map((r) => (
              <li key={r.label} className={r.ok ? styles.pass : styles.fail}>
                <ReadyIcon ok={r.ok} />
                <span className="sr-only">{r.ok ? 'Done: ' : 'Not done: '}</span>
                {r.label}
                {r.action && (
                  <>
                    {' · '}
                    <a href="#run-evals" onClick={(e) => { e.preventDefault(); focusRunEvals(); }}>Run evals</a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div aria-live="polite">
        {notice && (
          <div className="banner success" role="status">
            <Icon name="check" />
            <span className="grow">{notice}</span>
            <button type="button" className="link-btn" style={{ minHeight: 0 }} onClick={() => setNotice(null)}>Dismiss</button>
          </div>
        )}
      </div>

      {/* Scope: what the resolver picked. Read-only; the model never chooses its skills. */}
      <section className="card" aria-labelledby="scope-heading">
        <h2 id="scope-heading" className="sr-only">Scope</h2>
        <div className={styles.scope}>
          <div><span className="eyebrow">Application</span><span>{data.scope.appName}</span></div>
          <div><span className="eyebrow">Workflow</span><span>{data.scope.workflow}</span></div>
          <div><span className="eyebrow">Target path</span><span className="mono small">{data.scope.targetPath}</span></div>
          <div>
            <span className="eyebrow">Skills resolved from</span>
            <span><span className="mono small">{data.scope.skillsFile}</span> @ <span className="mono small">{data.scope.skillsCommit}</span></span>
          </div>
          <div><span className="eyebrow">Model</span><span>{data.scope.model}</span></div>
          <div style={{ marginLeft: 'auto', justifyContent: 'center' }}>
            <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setDialog('scope')}>Change scope</button>
          </div>
        </div>
      </section>

      <div className={styles.cols}>
        {/* Left: the layered system instruction */}
        <section className="card" aria-labelledby="si-heading" style={{ flex: '999 1 520px' }}>
          <div className="card-head">
            <h2 id="si-heading" style={{ fontSize: 16 }}>System instruction</h2>
            <span className="small muted">Assembled in this order · later layers cannot override policy</span>
          </div>
          <div className="card-pad">
            <ol className={styles.layers}>
              {data.layers.map((l, i) => (
                <li key={l.id}>
                  <LayerItem
                    layer={l}
                    order={i + 1}
                    text={texts[l.id] ?? l.liveText}
                    diff={diffs[l.id] ?? []}
                    savedLabel={savedLabels[l.id]}
                    open={!!open[l.id]}
                    onToggle={(v) => setOpen((o) => ({ ...o, [l.id]: v }))}
                    onChange={(v) => editLayer(l.id, v)}
                    onAttach={() => fileRef.current?.click()}
                  />
                </li>
              ))}
            </ol>
            {attachError && (
              <div className="banner warning" role="alert" style={{ marginTop: 10 }}>
                <Icon name="warning" />
                <span>{attachError}</span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".md,text/markdown"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                if (f.size > 64 * 1024) {
                  setAttachError(`${f.name} is over 64 KB and was not attached.`);
                  return;
                }
                setAttachError(null);
                const body = await f.text();
                editLayer('session', [sessionText, body].filter(Boolean).join('\n\n'));
                setOpen((o) => ({ ...o, session: true }));
              }}
            />
          </div>
          <div className={styles.assembled}>
            <span>
              <span className="mono" style={{ color: 'var(--text)' }}>{assembledTokens.toLocaleString('en-US')}</span> tokens assembled ·{' '}
              {differs || sessionText ? 'draft changes the skill-set hash, so the cached skill block is not used' : 'matches the live skill set, so the cached skill block is used'}
            </span>
            <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setDialog('assembled')}>View assembled prompt</button>
          </div>
        </section>

        {/* Right: try it and results */}
        <div className={styles.side}>
          <section className="card" aria-labelledby="try-heading">
            <div className="card-head">
              <h2 id="try-heading" style={{ fontSize: 16 }}>Try it</h2>
              <span className="small muted">Golden dataset sample</span>
            </div>
            <div className="card-pad stack">
              <div className="field">
                <label htmlFor="ps-sample">Sample task</label>
                <select id="ps-sample" className="select" value={sampleId} onChange={(e) => setSampleId(e.target.value)}>
                  {data.samples.map((s) => (
                    <option key={s.id} value={s.id}>{s.requirementId} · {s.title} (golden #{s.golden})</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ps-baseline">Compare with</label>
                <select id="ps-baseline" className="select" value={baseline} onChange={(e) => setBaseline(e.target.value)}>
                  {data.baselines.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div className={styles.sandbox}>
                <ShieldIcon />
                <span>
                  Runs in the Matrix sandbox against the golden repo snapshot. <span className="mono">write_file</span> goes to a scratch branch, nothing is pushed and no PR is opened.
                  No personal tokens are used. About 18k Tachyon tokens per side, counted to the team license.
                </span>
              </div>
              <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} disabled={runningSample} onClick={() => setRunningSample(true)}>
                {runningSample ? 'Running…' : baseline === 'No comparison' ? 'Run draft' : `Run ${baseline.replace(' live', '')} and draft${run ? ' again' : ''}`}
              </button>
            </div>
          </section>

          <section className="card" aria-labelledby="res-heading" aria-busy={runningSample}>
            <div className="card-head">
              <h2 id="res-heading" style={{ fontSize: 16 }}>Result</h2>
              {run && (
                <span className={styles.runMeta}>
                  <span>Run {run.id} · {run.agoLabel}</span>
                  <a href="#" /* TODO: MLflow trace URL for run.mlflowRunId */>Trace in MLflow</a>
                  <DownloadButton onClick={openDownload} />
                </span>
              )}
            </div>
            {!run ? (
              <div className="card-pad muted">No sample run yet. Choose a sample task and run it.</div>
            ) : (
              <>
                {runStale && (
                  <div className={`banner warning ${styles.inset}`} role="status">
                    <Icon name="warning" />
                    <span>Stale: this result is from draft revision {run.revision}. The draft has changed since (now revision {revision}). Run it again.</span>
                  </div>
                )}
                <div className="tabs" role="tablist" aria-label="Result views" style={{ padding: '0 18px' }}>
                  {([
                    ['checks', 'Checks'],
                    ['output', 'Output diff'],
                    ['tools', `Tool calls · ${sample.toolCalls.length}`],
                  ] as [ResultTab, string][]).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      id={`ps-tab-${k}`}
                      aria-controls="ps-tabpanel"
                      aria-selected={resultTab === k}
                      className="tab"
                      onClick={() => setResultTab(k)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className={`card-pad stack ${runStale ? styles.staleBody : ''}`} id="ps-tabpanel" role="tabpanel" aria-labelledby={`ps-tab-${resultTab}`}>
                  <span className="small muted">
                    Sample {sample.requirementId} · {sample.sampleVersion} · draft rev {run.revision} vs {run.baseline}
                    {run.baseline !== 'No comparison' && baselineLayer?.liveCommit ? ` @ ${baselineLayer.liveCommit}` : ''}
                  </span>
                  {resultTab === 'checks' && (
                    <table className={styles.checks}>
                      <thead>
                        <tr>
                          <th scope="col">Check</th>
                          {run.baseline !== 'No comparison' && <th scope="col">{run.baseline}</th>}
                          <th scope="col">Draft</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sample.baselineChecks.map((c, i) => {
                          const d = runDraftChecks[i];
                          return (
                            <tr key={c.name}>
                              <td>{c.name}</td>
                              {run.baseline !== 'No comparison' && <td className={c.pass ? styles.pass : styles.fail}>{c.pass ? 'Pass' : `Fail${c.detail ? ` · ${c.detail}` : ''}`}</td>}
                              <td className={d?.pass ? styles.pass : styles.fail}>{d?.pass ? 'Pass' : `Fail${d?.detail ? ` · ${d.detail}` : ''}`}</td>
                            </tr>
                          );
                        })}
                        <tr>
                          <td className="muted">Tokens</td>
                          {run.baseline !== 'No comparison' && <td className="mono muted small">{sample.tokens.baseline.toLocaleString('en-US')}</td>}
                          <td className="mono muted small">{sample.tokens.draft.toLocaleString('en-US')}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                  {resultTab === 'output' && (
                    <>
                      <span className="eyebrow">{sample.outputFile}</span>
                      {differs || sessionText ? (
                        <DiffBlock lines={sample.outputDiff} label={`Output difference, ${sample.outputFile}`} />
                      ) : (
                        <p className="small muted">The draft matches the live version, so the output is the same.</p>
                      )}
                    </>
                  )}
                  {resultTab === 'tools' && (
                    <ol className={styles.tools}>
                      {sample.toolCalls.map((t, i) => (
                        <li key={i}><span className="mono">{t.tool}</span> <span className="secondary">{t.target}</span></li>
                      ))}
                    </ol>
                  )}

                  <EvalSummary
                    evalRun={evalRun}
                    stale={evalStale}
                    passRate={evalPassRate}
                    gate={data.gate}
                    progress={evalProgress}
                    cases={data.dataset.cases}
                    datasetVersion={data.dataset.version}
                  />

                  <p className={styles.note}>
                    One sample is a quick check, not evidence. Next: run the draft on the full golden dataset. Opening the PR needs that result; promotion in Skills needs {data.gate}% or more.
                  </p>
                  <div className="row">
                    <button
                      ref={runEvalsRef}
                      type="button"
                      id="run-evals"
                      className="btn primary"
                      disabled={evalProgress !== null || evalsCurrent}
                      onClick={() => setEvalProgress(0)}
                    >
                      {evalProgress !== null ? `Running evals… ${evalProgress}/${data.dataset.cases}` : evalsCurrent ? 'Evals current for this draft' : 'Run evals on golden dataset'}
                    </button>
                    <button type="button" className="btn" disabled={run.saved || runStale} onClick={() => setRun({ ...run, saved: true })}>
                      {run.saved ? `Saved to ${data.currentDraftId}` : 'Save run to draft'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <DataTable
        id="drafts"
        title="Drafts"
        rows={draftRows}
        columns={columns}
        rowKey={(d) => d.id}
        searchLabel="Search drafts"
        searchPlaceholder="Search by draft, skill or author"
        onFilteredChange={(rows) => setFilteredDrafts(rows.map((r) => r.id))}
        minWidth={860}
        noun={draftUnit}
        actions={<span className="small muted">Kept for 30 days unless proposed · visible to the app team</span>}
      />

      <Dialog open={dialog === 'assembled'} onClose={() => setDialog(null)} title="Assembled prompt" subtitle={`${assembledTokens.toLocaleString('en-US')} tokens · draft hash ${draftHash}`} width={840}>
        <pre className="code" style={{ whiteSpace: 'pre-wrap' }}>
          {data.layers
            .filter((l) => l.kind === 'policy' || (texts[l.id] ?? '').trim())
            .map((l, i) => `### ${String(i + 1).padStart(2, '0')} ${l.name}\n${l.kind === 'policy' ? l.liveText : texts[l.id]}`)
            .join('\n\n')}
        </pre>
      </Dialog>

      <Dialog open={dialog === 'scope'} onClose={() => setDialog(null)} title="Change scope" width={560}>
        <div className="stack">
          <p className="secondary">
            Layers are resolved deterministically from <span className="mono">{data.scope.skillsFile}</span> for the chosen application, workflow and target path.
            Changing scope reloads the layers; your draft is kept.
          </p>
          {/* TODO(backend): scope picker (application, workflow, target path) backed by skill_bindings. */}
          <p className="small muted">Scope selection is not available in this preview.</p>
        </div>
      </Dialog>

      <Dialog
        open={dialog === 'pr'}
        onClose={() => setDialog(null)}
        title="Open PR on matrix-skills"
        width={600}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn dark" onClick={openPr}>Open pull request</button>
          </>
        }
      >
        <div className="stack">
          <dl className={styles.dl}>
            <dt>Branch</dt><dd className="mono">matrix/prompt-{data.currentDraftId.toLowerCase()}-r{revision}</dd>
            <dt>Changes</dt><dd>{changedLayers.map((l) => `${l.name}/SKILL.md`).join(', ')}</dd>
            <dt>Draft</dt><dd><span className="mono">{data.currentDraftId}</span> rev {revision} · hash <span className="mono">{draftHash}</span></dd>
            <dt>Evals</dt><dd>{evalRun ? `${evalPassRate}% on ${evalRun.datasetVersion} (${evalRun.passed}/${evalRun.cases})` : 'Not run'}</dd>
          </dl>
          {sessionText && <p className="small muted">Session instructions are not part of the PR.</p>}
          <p className="small muted">A person reviews and merges the PR. Promotion to live happens in Skills and needs {data.gate}% or more.</p>
        </div>
      </Dialog>
    </div>
  );
}

function LayerItem({ layer, order, text, diff, savedLabel, open, onToggle, onChange, onAttach }: {
  layer: InstructionLayer;
  order: number;
  text: string;
  diff: DiffLine[];
  savedLabel?: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  onChange: (v: string) => void;
  onAttach: () => void;
}) {
  const changes = changeCount(diff);
  const locked = layer.kind === 'policy';
  const cls = [styles.layer, locked ? styles.locked : '', changes > 0 ? styles.edited : ''].join(' ');
  const textareaId = `layer-${layer.id}`;

  return (
    <details className={cls} open={open} onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <Chevron />
        <span className={styles.order}>{String(order).padStart(2, '0')}</span>
        <span className={styles.layerName}>{layer.name}</span>
        <span className={styles.layerMeta}>
          {locked ? (
            <>
              <span className="pill"><Icon name="lock" size={12} strokeWidth={2.2} />Locked</span>
              <span className={styles.tag}>always first</span>
            </>
          ) : layer.kind === 'session' ? (
            <>
              <span className={styles.tag}>optional</span>
              {text.trim() ? <span className="pill tone-warning">Set · this session</span> : <span className="pill">Empty</span>}
            </>
          ) : (
            <>
              <span className={styles.tag}>{layer.kind}</span>
              {layer.versionLabel && <span className={styles.tag}>{layer.versionLabel}</span>}
              {changes > 0 ? (
                <span className="pill tone-warning">Draft · {changes} {changes === 1 ? 'change' : 'changes'}</span>
              ) : (
                <span className="pill">Unchanged</span>
              )}
            </>
          )}
        </span>
      </summary>
      <div className={styles.layerBody}>
        {locked ? (
          <>
            <pre className={styles.readonly}>{layer.liveText}</pre>
            {/* TODO(OPEN_QUESTIONS #15): where the base policy is stored and who may change it. */}
            <p className={styles.note}>Shown for reference. Nobody can edit the policy here.</p>
          </>
        ) : layer.kind === 'session' ? (
          <>
            <label htmlFor={textareaId} className="sr-only">Session instructions</label>
            <textarea
              id={textareaId}
              className={`${styles.textarea} ${styles.short}`}
              value={text}
              placeholder='Instructions for this session only, e.g. "Prefer the builder for amounts." Instructions only: no scripts, and they cannot override the policy.'
              onChange={(e) => onChange(e.target.value)}
            />
            <div className="row">
              <button type="button" className="btn" onClick={onAttach}>Attach SKILL.md</button>
            </div>
          </>
        ) : (
          <>
            <label htmlFor={textareaId} className="field-label">
              SKILL.md {layer.draft ? `(draft ${layer.draft.id})` : changes > 0 ? '(new draft)' : `(${layer.liveVersion ?? 'live'}; editing starts a draft)`}
            </label>
            <textarea id={textareaId} className={styles.textarea} spellCheck={false} value={text} onChange={(e) => onChange(e.target.value)} />
            {changes > 0 && (
              <div className="stack" style={{ '--gap': '4px' } as CSSProperties}>
                <span className="eyebrow">Changes from {layer.liveVersion}</span>
                <DiffBlock lines={diff} label={`Changes from ${layer.liveVersion}`} />
              </div>
            )}
            <p className={styles.note}>
              references/, scripts/ and evals/ are unchanged.{savedLabel ? ` Draft saved ${savedLabel}.` : ' Live runs keep using the live version.'}
            </p>
          </>
        )}
      </div>
    </details>
  );
}

function EvalSummary({ evalRun, stale, passRate, gate, progress, cases, datasetVersion }: {
  evalRun: EvalRun | null;
  stale: boolean;
  passRate: number;
  gate: number;
  progress: number | null;
  cases: number;
  datasetVersion: string;
}) {
  if (progress !== null) {
    return (
      <div className={styles.evalBox} role="status">
        <span style={{ fontWeight: 600 }}>Full golden dataset · {datasetVersion}</span>
        <div className={styles.track} role="progressbar" aria-label="Eval progress" aria-valuemin={0} aria-valuemax={cases} aria-valuenow={progress}>
          <span style={{ width: `${(progress / cases) * 100}%` }} />
        </div>
        <span className="small muted">{progress} of {cases} cases evaluated in the sandbox…</span>
      </div>
    );
  }
  if (!evalRun) return null;
  const meets = passRate >= gate;
  return (
    <div className={`${styles.evalBox} ${stale ? styles.staleBody : ''}`}>
      <span className="spread">
        <span style={{ fontWeight: 600 }}>Full golden dataset · {evalRun.datasetVersion}</span>
        {stale ? <span className="pill tone-warning">Stale · rev {evalRun.revision}</span> : <span className="pill tone-success">Current draft</span>}
      </span>
      <span className="small secondary">
        {evalRun.passed}/{evalRun.cases} cases · <strong>{passRate}%</strong> · evaluated draft rev {evalRun.revision}, hash <span className="mono">{evalRun.hash}</span>
      </span>
      <span className="small" style={{ color: meets ? 'var(--success-text)' : 'var(--danger-text)' }}>
        {meets ? `Meets the ${gate}% promotion gate (promotion happens in Skills after the PR merges).` : `Below the ${gate}% promotion gate. You can still open a PR for review.`}
      </span>
    </div>
  );
}

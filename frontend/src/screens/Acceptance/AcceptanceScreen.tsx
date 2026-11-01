// Reference: design/html/Acceptance.html
import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { DataTable, type Column, type TableView } from '../../components/DataTable';
import { Icon } from '../../components/Icon';
import { DownloadButton, ErrorState, Loading, PageHeader, Pill, StatCard } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec, type DownloadRequest } from '../../features/download/types';
import { useWorkLinks } from '../../navigation';
import { useStoryLink } from '../AcceptanceStory/links';
import { fetchAcceptance, requestWriteTests, type Story } from './api';
import { OctaneExportDialog } from './OctaneExportDialog';
import { useWorkspace } from '../../workspace/useWorkspace';
import styles from './Acceptance.module.css';

const TABLE_ID = 'acc-stories';

const untested = (s: Story) => s.criteriaTotal - s.criteriaTested;
const STATUS_LABEL: Record<Story['status'], string> = {
  not_started: 'Not started',
  awaiting_review: 'Awaiting review',
  criterion_untested: 'Criterion untested',
  no_ac: 'No acceptance criteria',
  ready_for_uat: 'Ready for UAT sign-off',
  signed_off: 'Signed off',
};
const statusValue = (s: Story) => (s.signoff?.changedAfterSignoff ? 'Changed after sign-off' : STATUS_LABEL[s.status]);
const criteriaValue = (s: Story) =>
  s.criteriaTotal === 0 || s.criteriaTested === 0 ? 'None' : untested(s) === 0 ? 'All tested' : 'Some untested';

/*
 * Per-story stage (UI_UX_REVIEW C4 and journey review). Stories move independently, so the
 * release is shown as counts per stage, not one sequential pipeline. Every count, view, KPI and
 * row action is derived from `stageOf`. The four AI stages (Story analysis, Test cases,
 * Automation, Tagging) are worked in the story workspace; then UAT sign-off and the Octane
 * sheet. A sign-off on an older revision is "renewal", never "signed off". Assignment is not
 * inferred (open product question).
 */
type Stage = 'writing' | 'analysis' | 'test_cases' | 'automation' | 'tagging' | 'no_ac' | 'uat' | 'renewal' | 'signed';

const AI_STAGE: Record<NonNullable<Story['aiStage']>, Stage> = {
  story_analysis: 'analysis', test_cases: 'test_cases', automation: 'automation', test_tagging: 'tagging',
};

function stageOf(s: Story, writing: Set<string>): Stage {
  if (writing.has(s._id)) return 'writing';
  switch (s.status) {
    case 'no_ac': return 'no_ac';
    case 'ready_for_uat': return 'uat';
    case 'signed_off': return s.signoff?.changedAfterSignoff ? 'renewal' : 'signed';
    default:
      if (s.aiStage) return AI_STAGE[s.aiStage];
      // Nothing generated yet: analysis comes first. Partly tested stories need more test cases.
      return s.status === 'not_started' ? 'analysis' : 'test_cases';
  }
}

/** Matrix can start (or continue) generating for the story: nothing waiting on a person. */
const canStart = (s: Story, writing: Set<string>) =>
  !s.aiStage && (s.status === 'not_started' || s.status === 'criterion_untested') && !writing.has(s._id);

const STAGES: { key: Stage; filter: string; count: (n: number) => string; owner: string; output: string }[] = [
  { key: 'writing', filter: 'Matrix working', count: () => 'in progress', owner: 'Matrix working', output: 'Output arrives in the story' },
  { key: 'analysis', filter: 'Story analysis', count: () => 'story analysis', owner: 'Needs QA', output: 'Accept analysis' },
  { key: 'test_cases', filter: 'Test cases', count: (n) => (n === 1 ? 'test case set' : 'test case sets'), owner: 'Needs QA', output: 'Accept test cases' },
  { key: 'automation', filter: 'Automation', count: () => 'automation', owner: 'Needs QA', output: 'Accept automation PR' },
  { key: 'tagging', filter: 'Tagging', count: () => 'tagging', owner: 'Needs QA', output: 'Approve tags' },
  { key: 'no_ac', filter: 'No criteria', count: () => 'no criteria', owner: 'Needs story owner', output: 'Criteria in Jira' },
  { key: 'uat', filter: 'Ready for UAT', count: () => 'ready for UAT', owner: 'Needs UAT', output: 'UAT sign-off' },
  { key: 'renewal', filter: 'Renewal required', count: (n) => (n === 1 ? 'renewal' : 'renewals'), owner: 'Needs UAT', output: 'Renewed sign-off' },
  { key: 'signed', filter: 'Signed off', count: () => 'signed off', owner: 'Ready to export', output: 'Octane sheet (manual import)' },
];
const STAGE_FILTER = Object.fromEntries(STAGES.map((s) => [s.key, s.filter])) as Record<Stage, string>;

const storiesUnit = { one: 'story', many: 'stories' };
const plural = (n: number, unit = storiesUnit) => `${n} ${n === 1 ? unit.one : unit.many}`;

function ChooseWorkspace({ stories }: { stories: Story[] }) {
  const { workspaces, application, setWorkspace } = useWorkspace();
  return (
    <div className="page">
      <PageHeader title="Acceptance" subtitle={`${application.name} (${application.id})`} />
      <section className="card card-pad stack" aria-labelledby="choose-ws">
        <h2 id="choose-ws">Choose a workspace</h2>
        <p className="secondary">
          Acceptance works inside one workspace: its stories, test cases, automation and Octane import sheet all belong to it.
          Pick one here or at the top right.
        </p>
        <div className="row">
          {workspaces.map((w) => {
            const n = stories.filter((s) => s.workspaceId === w.id).length;
            return (
              <button key={w.id} type="button" className="btn" onClick={() => setWorkspace(w.id)}>
                <span className="mono">{w.id}</span>
                <span className="muted">{n} {n === 1 ? 'story' : 'stories'}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function AcceptanceScreen() {
  const { current: workspace } = useWorkspace();
  const { data, error } = useApi(fetchAcceptance);
  const download = useDownloadReport();
  const links = useWorkLinks();
  const storyLink = useStoryLink();
  const [params, setParams] = useSearchParams();
  const [filtered, setFiltered] = useState<Story[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [writing, setWriting] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ count: number; jobId: string } | null>(null);
  const [suggested, setSuggested] = useState(false);
  const [octaneOpen, setOctaneOpen] = useState(false);
  const onFiltered = useCallback((rows: Story[]) => setFiltered(rows), []);

  const writeTests = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    setWriting((w) => new Set([...w, ...ids]));
    const res = await requestWriteTests(ids);
    setNotice({ count: ids.length, jobId: res.jobId });
  }, []);

  const views = useMemo<TableView<Story>[]>(() => [
    // Everything that is not a current sign-off: includes ready for UAT and renewal required.
    { key: 'action', label: 'Needs action', match: (s) => stageOf(s, writing) !== 'signed' },
    { key: 'all', label: 'All', match: () => true },
    { key: 'signed', label: 'Signed off', match: (s) => stageOf(s, writing) === 'signed' },
  ], [writing]);

  const columns = useMemo<Column<Story>[]>(() => [
    {
      key: 'story', header: 'Story', value: (s) => s._id, mono: true, width: 120,
      render: (s) => <Link to={storyLink(s._id)} className={styles.stepLink}>{s._id}<span className="sr-only">: open story workspace</span></Link>,
    },
    { key: 'title', header: 'Title', value: (s) => s.title, render: (s) => <span className={styles.storyTitle}>{s.title}</span> },
    {
      key: 'criteria', header: 'Criteria tested', value: criteriaValue,
      filter: { type: 'select', options: ['All tested', 'Some untested', 'None'] },
      render: (s) => (s.criteriaTotal === 0 ? '0' : `${s.criteriaTested} of ${s.criteriaTotal}`),
    },
    { key: 'tests', header: 'Tests', value: (s) => s.testCount, filter: { type: 'text' }, render: (s) => (s.status === 'no_ac' ? '–' : s.testCount) },
    {
      key: 'status', header: 'Status', value: statusValue,
      // The filter is by stage, so the release stage counts above can filter the table.
      filter: { type: 'select', options: STAGES.map((s) => s.filter), match: (s, v) => STAGE_FILTER[stageOf(s, writing)] === v },
      render: (s) => <StoryStatusPill story={s} />,
    },
    {
      key: 'action', header: 'Action', value: () => '', filter: { type: 'none' }, sortable: false,
      render: (s) => {
        switch (stageOf(s, writing)) {
          case 'writing':
            return <span className="muted">Writing tests…</span>;
          case 'analysis':
          case 'test_cases':
          case 'automation':
          case 'tagging': {
            if (canStart(s, writing)) {
              return (
                <button type="button" className={`link-btn ${styles.actionBtn}`} onClick={() => writeTests([s._id])}>
                  {s.status === 'not_started' ? 'Analyse story' : `Write missing ${untested(s) === 1 ? 'test' : 'tests'}`}
                  <span className="sr-only"> for {s._id}</span>
                </button>
              );
            }
            const st = STAGES.find((x) => x.key === stageOf(s, writing))!;
            return (
              <span className="row" style={{ gap: '0 12px' }}>
                <Link to={storyLink(s._id, s.aiStage)} className={styles.stepLink}>{st.output}<span className="sr-only"> for {s._id}</span></Link>
                {s.reviewId && <Link to={links.review({ item: s.reviewId, ref: s._id })} className={styles.stepLink}>Review queue<span className="sr-only"> for {s._id}</span></Link>}
              </span>
            );
          }
          case 'no_ac':
            // TODO(integration): open the Jira issue; comments post as the user via the credential broker.
            return <a href={s.jiraUrl} className={styles.stepLink}>Comment in Jira<span className="sr-only"> on {s._id}</span></a>;
          case 'uat':
            return <Link to={links.huddle({ ref: s._id })} className={styles.stepLink}>Sign off in Huddle<span className="sr-only"> for {s._id}</span></Link>;
          case 'renewal':
            return <Link to={links.huddle({ ref: s._id })} className={styles.stepLink}>Renew sign-off<span className="sr-only"> for {s._id}</span></Link>;
          case 'signed':
            return (
              <button type="button" className={`link-btn ${styles.actionBtn}`} aria-haspopup="dialog" onClick={() => setOctaneOpen(true)}>
                In Octane sheet<span className="sr-only"> ({s._id})</span>
              </button>
            );
        }
      },
    },
  ], [writing, writeTests, links, storyLink]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;
  // Acceptance works inside one workspace (component), chosen at the top right.
  if (!workspace) return <ChooseWorkspace stories={data.stories} />;

  const { release, pipeline } = data;
  const stories = data.stories.filter((s) => s.workspaceId === workspace.id);
  const byStage = (k: Stage) => stories.filter((s) => stageOf(s, writing) === k);
  const counts = Object.fromEntries(STAGES.map((st) => [st.key, byStage(st.key).length])) as Record<Stage, number>;
  const criteriaTotal = stories.reduce((n, s) => n + s.criteriaTotal, 0);
  const criteriaTested = stories.reduce((n, s) => n + s.criteriaTested, 0);
  const inReview = byStage('test_cases').filter((s) => s.status === 'awaiting_review');
  const awaitingTests = inReview.reduce((n, s) => n + s.testCount, 0);
  const qaStages: Stage[] = ['analysis', 'test_cases', 'automation', 'tagging'];
  const signed = byStage('signed');
  const renewal = byStage('renewal');
  const uat = byStage('uat');
  const blocked = byStage('no_ac');
  const handoffTests = signed.reduce((n, s) => n + s.testCount, 0);
  const context = `Acceptance · ${data.application} · ${release.name}`;
  const pct = criteriaTotal ? Math.round((criteriaTested / criteriaTotal) * 100) : 0;

  // Start Matrix: one rule for bulk and rows (nothing generated or waiting); scope is the selection or all eligible.
  const selectedSet = new Set(selected);
  const writeScope = selected.length ? stories.filter((s) => selectedSet.has(s._id)) : stories;
  const writeTargets = writeScope.filter((s) => canStart(s, writing));
  const writeLabel = selected.length
    ? `Start Matrix for ${writeTargets.length} selected ${writeTargets.length === 1 ? 'story' : 'stories'}`
    : `Start Matrix for all ${writeTargets.length} eligible ${writeTargets.length === 1 ? 'story' : 'stories'}`;
  // Earliest AI stage with a story waiting for QA; opens that story's workspace.
  const qaNext = qaStages.map((k) => ({ k, list: byStage(k).filter((s) => !canStart(s, writing)) })).find((x) => x.list.length > 0);

  // One next action, chosen from the earliest stage that needs a person.
  type Next = { stage: Stage; label: string; to?: string; onClick?: () => void; dialog?: boolean };
  const next: Next | null =
    qaNext ? {
      stage: qaNext.k,
      label: `${STAGES.find((x) => x.key === qaNext.k)!.output} for ${qaNext.list[0]._id}`,
      to: storyLink(qaNext.list[0]._id, qaNext.list[0].aiStage),
    }
    : uat.length || renewal.length ? {
      stage: uat.length ? 'uat' : 'renewal',
      label: `Sign off ${plural(uat.length + renewal.length)} in Huddle`,
      to: links.huddle({ ref: (uat[0] ?? renewal[0])._id }),
    }
    : writeTargets.length ? { stage: 'analysis', label: writeLabel, onClick: () => writeTests(writeTargets.map((s) => s._id)) }
    : signed.length ? { stage: 'signed', label: 'Export Octane import sheet', onClick: () => setOctaneOpen(true), dialog: true }
    : null;

  const activeStageFilter = params.get(`${TABLE_ID}.f.status`);
  const filterStage = (k: Stage) => {
    const label = STAGE_FILTER[k];
    setParams((prev) => {
      const q = new URLSearchParams(prev);
      q.delete(`${TABLE_ID}.page`);
      if (activeStageFilter === label) {
        q.delete(`${TABLE_ID}.f.status`);
      } else {
        q.set(`${TABLE_ID}.f.status`, label);
        q.set(`${TABLE_ID}.view`, 'all');
      }
      return q;
    }, { replace: true });
    document.getElementById('stories')?.scrollIntoView({ block: 'start' });
  };
  // Tiles only for stages holding stories (or the active filter, so it can be cleared); empty stages
  // collapse to one muted line. Rows are balanced: 8 tiles lay out 4 + 4, not 7 + 1.
  const stageTiles = STAGES.filter((st) => counts[st.key] > 0 || activeStageFilter === st.filter);
  const emptyStages = STAGES.filter((st) => st.key !== 'writing' && !stageTiles.includes(st));
  const stageCols = Math.ceil(stageTiles.length / Math.ceil(stageTiles.length / 5)) || 1;
  const stageSummary = STAGES.filter((st) => counts[st.key] > 0).map((st) => `${counts[st.key]} ${st.count(counts[st.key])}`).join(' · ');

  const filterState = () => {
    const state: Record<string, string | null> = {
      q: params.get(`${TABLE_ID}.q`),
      view: params.get(`${TABLE_ID}.view`) ?? views[0].key,
    };
    for (const c of columns) state[`f.${c.key}`] = params.get(`${TABLE_ID}.f.${c.key}`);
    return state;
  };

  const openDownload = () => {
    const request: DownloadRequest = {
      context,
      reportTypes: [
        { key: 'test-cases', label: 'Test cases', description: 'Test IDs, story and criterion links, ordered steps, expected results, review and sign-off state, revisions and sources.', formats: ['xlsx'] },
        { key: 'criterion-coverage', label: 'Criterion coverage', description: 'Acceptance criteria with test cases versus untested, per story, with numerator and denominator.', formats: ['pdf', 'html', 'xlsx'] },
        {
          key: 'signoff-record', label: 'UAT sign-off record',
          description: 'Signed-off revisions, signatory and time, pending stories and changed-after-sign-off state.',
          formats: ['pdf', 'html', 'xlsx'],
          records: { full: `${signed.length} current sign-offs, ${renewal.length} renewal required, ${uat.length} ready for UAT` },
        },
      ],
      defaultReportType: 'test-cases',
      scope: {
        selected: selected.length ? { count: selected.length, unit: storiesUnit, ids: [...selected].sort() } : undefined,
        filtered: { count: filtered.length, unit: storiesUnit, spec: filterSpec(filterState()) },
        full: { count: stories.length, unit: storiesUnit },
      },
      snapshot: data.snapshot,
      snapshotCapturedAt: release.syncedAtIso,
      filters: `Fix version: ${release.jiraFixVersion}`,
      comparison: `Whole release: ${criteriaTested} of ${criteriaTotal} criteria have a test`,
      selectionHint: 'Select stories in the table to use this',
    };
    download.open(request);
  };

  return (
    <div className="page">
      <PageHeader
        title={`Acceptance · ${release.name}`}
        subtitle={`${stories.length} stories from Jira fix version ${release.jiraFixVersion} · ${criteriaTotal} acceptance criteria · synced ${release.syncedAt}`}
      />
      <div className={`row ${styles.headActions}`}>
        {next?.to && <Link to={next.to} className="btn primary">{next.label}</Link>}
        {next?.onClick && (
          <button type="button" className="btn primary" aria-haspopup={next.dialog ? 'dialog' : undefined} onClick={next.onClick}>{next.label}</button>
        )}
        {!(next?.onClick && next.stage === 'analysis') && (
          <button type="button" className="btn" disabled={writeTargets.length === 0} onClick={() => writeTests(writeTargets.map((s) => s._id))}>
            {writeLabel}
          </button>
        )}
        {next?.stage !== 'signed' && (
          <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setOctaneOpen(true)}>Export Octane import sheet</button>
        )}
        <DownloadButton onClick={openDownload} />
      </div>

      {notice && (
        <div className="banner" role="status">
          <Icon name="info" />
          <span>
            Matrix is working on {plural(notice.count)} (job <span className="mono">{notice.jobId}</span>).
            Each output waits for your rating and acceptance in the story workspace.{' '}
            <Link to={`/processing?workflow=acceptance&job=${encodeURIComponent(notice.jobId)}`}>Follow processing</Link>
          </span>
        </div>
      )}

      <div className="kpis">
        <StatCard label="Stories in release" value={stories.length} note={`Jira · ${release.jiraFixVersion}`} />
        <StatCard label="Criteria with a test" value={criteriaTested} unit={`${pct}%`} note={`of ${criteriaTotal} acceptance criteria`} />
        <StatCard label="Tests awaiting review" value={awaitingTests} tone={awaitingTests ? 'accent' : undefined} note="QA review before UAT" />
        <StatCard label="Waiting on UAT" value={uat.length + renewal.length} note={`${uat.length} ready · ${renewal.length} renewal required`} />
        <StatCard label="Signed off by UAT" value={signed.length} note={`of ${stories.length} stories at their current revision`} />
      </div>

      <section className="card" aria-labelledby="acc-progress-heading">
        <div className={styles.pipelineHead}>
          <div className={styles.headLeft}>
            <h2 id="acc-progress-heading" style={{ fontSize: 16 }}>Release progress</h2>
            <span className="small secondary" style={{ fontSize: 13 }}>Stories move independently. Choose a stage to filter the table.</span>
          </div>
          <Link to="/processing?workflow=acceptance" className={styles.previewLink}>Preview processing controls</Link>
        </div>
        <p className={styles.stageSummary}>{stageSummary}</p>
        <ul className={styles.stages} style={{ '--cols': stageCols } as CSSProperties}>
          {stageTiles.map((st) => {
            const n = counts[st.key];
            const isNext = next?.stage === st.key;
            return (
              <li key={st.key} className={isNext ? styles.stageNext : undefined}>
                <button
                  type="button"
                  className={`${styles.stage} ${isNext ? styles.stageCurrent : ''}`}
                  aria-pressed={activeStageFilter === st.filter}
                  onClick={() => filterStage(st.key)}
                >
                  <span className={styles.stageCount}>{n}</span>
                  <span className={styles.stageLabel}>{st.count(n)}</span>
                  <span className={styles.owner}>{st.owner}</span>
                  <span className={styles.stageOutput}>Next: {st.output}</span>
                  <span className="sr-only">. Filter the stories table to this stage.</span>
                </button>
              </li>
            );
          })}
        </ul>
        {emptyStages.length > 0 && (
          <p className={styles.emptyStages}>Nothing waiting in: {emptyStages.map((st) => st.filter).join(', ')}</p>
        )}
        <div className={styles.setup}>
          <span className={styles.setupLine}>
            <Icon name="check" size={14} strokeWidth={2.4} />
            Release setup done by Matrix: {pipeline.map((p) => p.title).join(' · ')} · started {release.startedAt}
          </span>
          <details className={styles.evidence}>
            <summary>Details</summary>
            <ul className={styles.evidenceList}>
              {pipeline.map((p) => (
                <li key={p.key}>
                  <strong>{p.title}:</strong> {p.description} <span className={styles.tools}>{p.tools.join(' · ')}</span>
                </li>
              ))}
              <li>
                <strong>Per story:</strong> Matrix analyses the story, writes test cases, writes automation as a PR on a matrix/* branch and suggests suite tags; QA rates and accepts each output in the story workspace. UAT signs off in Huddle, then the Octane import sheet is exported for manual import.
                {' '}<span className={styles.tools}>Tachyon · GitHub · Huddle · Octane sheet</span>
              </li>
            </ul>
          </details>
        </div>
      </section>

      <div id="stories" className={styles.tableFix}>
        <DataTable
          id={TABLE_ID}
          title={<h2 style={{ fontSize: 16 }}>Stories</h2>}
          rows={stories}
          columns={columns}
          rowKey={(s) => s._id}
          views={views}
          selectable
          onSelectionChange={setSelected}
          onFilteredChange={onFiltered}
          rowLabel={(s) => `${s._id} ${s.title}`}
          searchLabel="Search stories"
          searchPlaceholder="Search by keyword, story key or title"
          pageSizes={[6, 25, 50]}
          noun={storiesUnit}
          minWidth={900}
        />
      </div>

      <div className={styles.sideGrid}>
        {blocked.length > 0 && (
          <section className={`card ${styles.sideCard}`} aria-labelledby="attn-heading">
            <h2 id="attn-heading" style={{ fontSize: 15 }}>Blocked on the story</h2>
            <p className="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
              <span className="mono">{blocked.map((s) => s._id).join(', ')}</span>{' '}
              {blocked.length === 1 ? 'has' : 'have'} no acceptance criteria, so Matrix can't write tests for {blocked.length === 1 ? 'it' : 'them'} yet.
            </p>
            {suggested && (
              <span role="status" className="small secondary">
                Suggested criteria will be drafted from app context and posted to Huddle for the story owner to confirm.
              </span>
            )}
            <div className="row">
              {/* TODO(integration): Jira comment as the user through the credential broker. */}
              <a href={blocked[0].jiraUrl} className="btn dark">Comment in Jira</a>
              <button type="button" className="btn" disabled={suggested} onClick={() => setSuggested(true)}>Suggest criteria</button>
            </div>
          </section>
        )}

        <section className={`card ${styles.sideCard}`} aria-labelledby="signoff-heading">
          <div className="spread">
            <h2 id="signoff-heading" style={{ fontSize: 15 }}>UAT sign-off</h2>
            <span className="mono small muted">{signed.length} of {stories.length} current</span>
          </div>
          <div
            className={styles.progress}
            role="progressbar"
            aria-label="Stories signed off at their current revision"
            aria-valuemin={0}
            aria-valuemax={stories.length}
            aria-valuenow={signed.length}
          >
            <div className={styles.progressBar} style={{ width: `${(signed.length / Math.max(1, stories.length)) * 100}%` }} />
          </div>
          <h3 className={styles.listHead}>Signed off</h3>
          <ul className={styles.signoffs}>
            {signed.map((s) => (
              <li key={s._id}>
                <span className="mono">{s._id}</span> signed off by {s.signoff!.userName}, {s.signoff!.at} · rev {s.signoff!.storyRevision}
              </li>
            ))}
            {signed.length === 0 && <li>None yet.</li>}
          </ul>
          {renewal.length > 0 && (
            <>
              <h3 className={styles.listHead}>Renewal required · not counted as signed off</h3>
              <ul className={styles.signoffs}>
                {renewal.map((s) => (
                  <li key={s._id}>
                    <span className="mono">{s._id}</span> signed off at rev {s.signoff!.storyRevision} by {s.signoff!.userName}, {s.signoff!.at}{' '}
                    <Pill tone="warning">Changed · now rev {s.revision}</Pill>{' '}
                    <Link to={links.huddle({ ref: s._id })} className={styles.stepLink}>Renew sign-off<span className="sr-only"> for {s._id}</span></Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link to={links.huddle({})} className={styles.stepLink}>Open Huddle</Link>
        </section>

        <section className={`card ${styles.sideCard} ${styles.handoff}`} aria-labelledby="handoff-heading">
          <h2 id="handoff-heading" style={{ fontSize: 15 }}>Hand off to regression</h2>
          <p className="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
            When {release.name} ships, its signed-off tests join the regression suite and Matrix writes their automation there.
          </p>
          <div className="spread">
            <span className="mono small muted">{handoffTests} tests ready</span>
            <Link to="/regression" className={styles.stepLink}>Go to regression</Link>
          </div>
        </section>
      </div>

      <OctaneExportDialog
        open={octaneOpen}
        onClose={() => setOctaneOpen(false)}
        stories={stories}
        context={context}
        snapshot={data.snapshot}
      />
    </div>
  );
}

function StoryStatusPill({ story }: { story: Story }) {
  switch (story.status) {
    case 'not_started': return <Pill>Not started</Pill>;
    case 'awaiting_review': return <Pill tone="outline">Awaiting review</Pill>;
    case 'criterion_untested': {
      const n = untested(story);
      return <Pill tone="accent">{n} {n === 1 ? 'criterion' : 'criteria'} untested</Pill>;
    }
    case 'no_ac': return <Pill tone="warning">No acceptance criteria</Pill>;
    case 'ready_for_uat': return <Pill>Ready for UAT sign-off</Pill>;
    case 'signed_off':
      return story.signoff?.changedAfterSignoff
        ? <Pill tone="warning">Changed after sign-off</Pill>
        : <Pill tone="success">Signed off</Pill>;
  }
}

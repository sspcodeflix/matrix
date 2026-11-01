import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useWorkspace } from '../../workspace/useWorkspace';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchSession } from '../../api/session';
import { useApi } from '../../api/useApi';
import { Icon } from '../../components/Icon';
import { DownloadButton, ErrorState, Loading, Pill } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec } from '../../features/download/types';
import { useWorkLinks, useWorkTarget } from '../../navigation';
import { exclusionNote, useTestCaseSet } from '../../features/testcases';
import { OctaneExportDialog } from '../Acceptance/OctaneExportDialog';
import {
  acceptStage, fetchStoryWorkspace, fetchTagVocabulary, reconcileWorkspace, regenerateStage, STAGE_ORDER,
  type StageKey, type StoryWorkspace, type TagSuggestion, type TagVocabulary, type TestCase,
} from './api';
import { STAGE_META } from './meta';
import { AnalysisView, AutomationView, TaggingView, TestCasesView } from './outputs';
import { StagePanel } from './StagePanel';
import styles from './AcceptanceStory.module.css';

type PanelKey = StageKey | 'uat';
const testsUnit = { one: 'test case', many: 'test cases' };

/** The stage that needs someone now: first AI stage not yet accepted, else UAT. */
function currentStage(ws: StoryWorkspace): PanelKey {
  return STAGE_ORDER.find((k) => ws.stages[k].status !== 'accepted' && ws.stages[k].status !== 'not_started') ?? 'uat';
}

function nextActors(ws: StoryWorkspace): { actor: string; action: string }[] {
  const out: { actor: string; action: string }[] = [];
  for (const k of STAGE_ORDER) {
    const s = ws.stages[k].status;
    if (s === 'generating') out.push({ actor: 'Matrix working', action: `Writing ${STAGE_META[k].title.toLowerCase()}` });
    if (s === 'needs_review') out.push({ actor: 'Needs QA', action: `Rate and accept ${STAGE_META[k].title.toLowerCase()}` });
  }
  if (ws.uat === 'ready') out.push({ actor: 'Needs UAT', action: 'Sign off in Huddle' });
  if (ws.uat === 'renewal') out.push({ actor: 'Needs UAT', action: 'Renew sign-off in Huddle' });
  if (ws.uat === 'signed_off') out.push({ actor: 'Ready to export', action: 'Octane import sheet (manual import)' });
  return out;
}

export default function AcceptanceStoryScreen() {
  const { storyId = '' } = useParams();
  const { data, error } = useApi(() => fetchStoryWorkspace(storyId), [storyId]);
  const session = useApi(fetchSession);
  const vocab = useApi(fetchTagVocabulary);
  const target = useWorkTarget();
  const back = target.back ?? { to: '/acceptance', label: 'Back to Acceptance' };
  // A story belongs to one workspace; keep the top-right selector (and the Octane target) on it.
  const { current: workspace, setWorkspace } = useWorkspace();
  const storyWorkspace = data?.story.workspaceId;
  useEffect(() => {
    if (storyWorkspace && workspace?.id !== storyWorkspace) setWorkspace(storyWorkspace);
  }, [storyWorkspace, workspace?.id, setWorkspace]);

  const backLink = (
    <Link to={back.to} className={styles.back}>
      <Icon name="chevronLeft" size={16} /> {back.label}
    </Link>
  );

  if (error || session.error || vocab.error) return <ErrorState error={(error ?? session.error ?? vocab.error)!} />;
  if (data === undefined || !session.data || !vocab.data) return <Loading />;
  if (data === null) {
    return (
      <div className="page">
        {backLink}
        <section className="card card-pad stack" aria-labelledby="none-heading">
          <h1 id="none-heading" style={{ fontSize: 20 }}>No Acceptance workspace for <span className="mono">{storyId}</span> yet</h1>
          <p className="secondary">
            A workspace is created when Matrix analyses the story. Start it from the stories table on Acceptance
            (Analyse story or Write tests); stories without acceptance criteria need criteria in Jira first.
          </p>
        </section>
      </div>
    );
  }

  return <Workspace key={storyId} initial={data} userName={session.data.user.name} applicationName={session.data.application.name} vocab={vocab.data} backLink={backLink} />;
}

function Workspace({ initial, userName, applicationName, vocab, backLink }: {
  initial: StoryWorkspace;
  userName: string;
  applicationName: string;
  vocab: TagVocabulary;
  backLink: ReactNode;
}) {
  const [ws, setWs] = useState(initial);
  const [busy, setBusy] = useState<{ stage: StageKey; kind: 'accept' | 'regenerate' } | null>(null);
  const [tagEdits, setTagEdits] = useState<TagSuggestion[]>(initial.tags ?? []);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [filteredTests, setFilteredTests] = useState<TestCase[]>([]);
  const [octaneOpen, setOctaneOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const download = useDownloadReport();
  const links = useWorkLinks();

  const { story } = ws;
  // Test cases and their decisions come from the story's shared set, the same one Review shows.
  const { set, release } = useTestCaseSet(story._id);
  const released = release?.released;
  const tcAccepted = ws.stages.test_cases.status === 'accepted';
  // A set accepted or changed in Review moves the story on, or back, here too.
  useEffect(() => {
    if (released === undefined || released === tcAccepted || busy) return;
    const next = reconcileWorkspace(story._id);
    if (next) setWs(next);
  }, [released, tcAccepted, busy, story._id]);
  const current = currentStage(ws);
  const requested = params.get('stage') as PanelKey | null;
  const shown: PanelKey = requested && (requested === 'uat' || STAGE_ORDER.includes(requested)) ? requested : current;
  const show = (k: PanelKey) =>
    setParams((prev) => {
      const q = new URLSearchParams(prev);
      q.set('stage', k);
      return q;
    }, { replace: true });

  const [acceptError, setAcceptError] = useState('');
  const accept = async (stage: StageKey) => {
    setBusy({ stage, kind: 'accept' });
    setAcceptError('');
    try {
      const next = await acceptStage(story._id, stage, userName, stage === 'test_tagging' ? { tags: tagEdits } : undefined);
      setWs(next);
      setTagEdits(next.tags ?? []);
      show(currentStage(next));
    } catch (e) {
      setAcceptError(`Not accepted: ${(e as Error).message}.`);
    } finally {
      setBusy(null);
    }
  };
  const regenerate = async (stage: StageKey, instruction: string) => {
    setBusy({ stage, kind: 'regenerate' });
    const next = await regenerateStage(story._id, stage, instruction);
    setWs(next);
    if (stage === 'test_tagging') setTagEdits(next.tags ?? []);
    setBusy(null);
  };

  const context = `Acceptance · ${applicationName} · ${story._id}`;
  const snapshot = `Story ${story._id} rev ${story.revision} · test cases rev ${release?.generation.outputRevision ?? 0}`;
  const tests = set?.cases ?? [];

  const openDownload = () => {
    download.open({
      title: 'Download test cases',
      context,
      reportTypes: [{
        key: 'test-cases', label: 'Test cases', formats: ['xlsx'],
        description: 'Test IDs, story and criterion links, preconditions, ordered steps, expected results, @role/@data needs, review state, revisions and sources.',
        formatNotes: { xlsx: 'Summary, Test cases, Steps and Sources sheets' },
      }],
      defaultReportType: 'test-cases',
      scope: {
        selected: selectedTests.length ? { count: selectedTests.length, unit: testsUnit, ids: [...selectedTests].sort() } : undefined,
        filtered: { count: filteredTests.length, unit: testsUnit, ids: filteredTests.map((t) => t._id).sort(), spec: filterSpec({ story: story._id, q: params.get('story-tests.q'), criterion: params.get('story-tests.f.criterion'), state: params.get('story-tests.f.state') }) },
        full: { count: tests.length, unit: testsUnit, ids: tests.map((t) => t._id).sort(), hint: `All test cases for ${story._id}` },
      },
      snapshot,
      snapshotCapturedAt: set?.generatedAt,
      filters: `Story: ${story._id}`,
      applicationName,
      selectionHint: 'Select test cases in the table to use this',
    });
  };

  const octaneButton = (primary = false) => (
    <button type="button" className={`btn ${primary ? 'primary' : ''}`} aria-haspopup="dialog" onClick={() => setOctaneOpen(true)}>
      Export Octane import sheet
    </button>
  );

  const stepState = (k: PanelKey) => {
    if (k === 'uat') {
      return ws.uat === 'signed_off' ? { done: true, text: `Signed off by ${story.signoff?.userName ?? 'UAT'} · ready to export` }
        : ws.uat === 'renewal' ? { done: false, text: 'Renewal required' }
        : ws.uat === 'ready' ? { done: false, text: 'Ready for UAT sign-off' }
        : { done: false, text: 'Opens when test cases are accepted' };
    }
    const s = ws.stages[k];
    return s.status === 'accepted' ? { done: true, text: `Accepted by ${s.acceptedBy}` }
      : s.status === 'needs_review' ? { done: false, text: 'Needs your review' }
      : s.status === 'generating' ? { done: false, text: 'Matrix generating' }
      : { done: false, text: 'Not started' };
  };

  const actors = nextActors(ws);

  const step = (k: PanelKey, num: number) => {
    const s = stepState(k);
    const isCurrent = k === current;
    return (
      <li key={k}>
        <button
          type="button"
          className={`${styles.stepBtn} ${s.done ? styles.stepDone : ''} ${isCurrent ? styles.stepCurrent : ''}`}
          aria-pressed={shown === k}
          aria-current={isCurrent ? 'step' : undefined}
          aria-controls={`panel-${k}`}
          onClick={() => show(k)}
        >
          <span className={styles.stepNum}>Step {num}{isCurrent ? ' · current' : ''}</span>
          <span className={styles.stepTitle}>{k === 'uat' ? 'UAT sign-off · Octane export' : STAGE_META[k].title}</span>
          <span className={`${styles.stepState} ${s.done ? styles.stepDoneText : isCurrent ? styles.stepCurrentText : ''}`}>
            {s.done && <Icon name="check" size={12} strokeWidth={2.4} />} {s.text}
          </span>
        </button>
      </li>
    );
  };
  const inBranch = current === 'automation' || current === 'test_tagging' || current === 'uat';

  const panelFor = (k: StageKey) => {
    const state = k === 'test_cases' ? { ...ws.stages.test_cases, generation: release?.generation } : ws.stages[k];
    const idx = STAGE_ORDER.indexOf(k);
    const common = {
      stage: k, state, userId: userName,
      previousTitle: idx > 0 ? STAGE_META[STAGE_ORDER[idx - 1]].title.toLowerCase() : undefined,
      busy: busy?.stage === k ? busy.kind : null,
      onAccept: () => accept(k),
      onRegenerate: (i: string) => regenerate(k, i),
    };
    switch (k) {
      case 'story_analysis':
        return <StagePanel {...common}>{ws.analysis && <AnalysisView analysis={ws.analysis} />}</StagePanel>;
      case 'test_cases':
        return (
          <StagePanel
            {...common}
            release={release && {
              blocker: release.canAccept ? undefined : release.reason,
              note: (
                <>
                  Releases {release.included.length} test {release.included.length === 1 ? 'case' : 'cases'} at revision {release.generation.outputRevision} to
                  UAT sign-off and to automation, which run in parallel. {exclusionNote(release)} Per-test Accept and Reject in the Review queue stay provisional until then.
                </>
              ),
            }}
            extraActions={
              <>
                <DownloadButton label="Download test cases" onClick={openDownload} />
                {octaneButton()}
                {story.reviewId && <Link to={links.review({ item: story.reviewId, ref: story._id })} className="btn ghost">Per-test review in Review queue</Link>}
              </>
            }
          >
            {ws.analysis && <TestCasesView tests={tests} citations={ws.analysis.citations} onSelectionChange={setSelectedTests} onFilteredChange={setFilteredTests} />}
          </StagePanel>
        );
      case 'automation':
        return <StagePanel {...common}>{ws.automation && <AutomationView automation={ws.automation} />}</StagePanel>;
      case 'test_tagging':
        return (
          <StagePanel {...common}>
            {ws.tags && (
              <>
                <p className="small secondary">Matrix suggests suite tags; change any before approving. Tags come from this application's tag vocabulary.</p>
                <TaggingView suggestions={ws.tags} edits={tagEdits} vocab={vocab} readOnly={state.status !== 'needs_review'} onChange={setTagEdits} />
              </>
            )}
          </StagePanel>
        );
    }
  };

  return (
    <div className="page">
      {backLink}
      <header className={styles.header}>
        <span className="eyebrow">Acceptance story</span>
        <h1 className={styles.title}><span className="mono">{story._id}</span> · {story.title}</h1>
        <div className={styles.meta}>
          {/* TODO(integration): Jira browse URL. */}
          <a href={story.jiraUrl} className={styles.jira}>Open in Jira <Icon name="external" size={14} /></a>
          <span>Story rev {story.revision}</span>
          <StoryPill ws={ws} />
          <span>{story.criteriaTotal} acceptance criteria · {tests.length} test cases</span>
        </div>
        <div className={styles.next} role="status">
          <span className={styles.nextLabel}>Who acts next</span>
          {actors.length === 0 && <span>Nothing waiting.</span>}
          {actors.map((a) => (
            <span key={a.actor + a.action} className="row" style={{ '--gap': '6px' } as CSSProperties}>
              <span className={styles.actor}>{a.actor}</span> {a.action}
            </span>
          ))}
        </div>
      </header>

      <nav aria-label="Story stages">
        <ol className={styles.flow}>
          <li className={current === 'story_analysis' ? styles.currentItem : undefined}><ol className={styles.track}>{step('story_analysis', 1)}</ol></li>
          <li className={current === 'test_cases' ? styles.currentItem : undefined}><ol className={styles.track}>{step('test_cases', 2)}</ol></li>
          <li className={`${styles.parallel} ${inBranch ? styles.currentItem : ''}`}>
            <span className={styles.branchLabel}>
              <BranchIcon /> Accepting test cases opens both tracks. They run in parallel.
            </span>
            <div className={styles.tracks}>
              <div className={styles.trackGroup}>
                <span className={styles.trackName}>Automation track</span>
                <ol className={styles.track} aria-label="Automation track">{step('automation', 3)}{step('test_tagging', 4)}</ol>
              </div>
              <div className={styles.trackGroup}>
                <span className={styles.trackName}>UAT track</span>
                <ol className={styles.track} aria-label="UAT track">{step('uat', 3)}</ol>
              </div>
            </div>
          </li>
        </ol>
      </nav>
      {acceptError && <div className="banner accent" role="alert"><Icon name="warning" /><span>{acceptError}</span></div>}

      {shown === 'uat' ? (
        <section className={`card ${styles.panel}`} id="panel-uat" aria-labelledby="uat-heading">
          <div className={styles.panelHead}>
            <h2 id="uat-heading" style={{ fontSize: 18 }}>UAT sign-off and Octane export</h2>
            <StoryPill ws={ws} />
          </div>
          {ws.uat === 'not_ready' && (
            <p className="secondary">
              UAT sign-off opens once the test case set is rated and accepted (step 2). It then runs in parallel with automation and tagging. Nothing can be exported yet.
              {release && !release.released && <> Now: {release.reason || 'the set is rated; accept it in Test cases'}.</>}
            </p>
          )}
          {ws.uat === 'ready' && (
            <p className="secondary">
              {release?.included.length ?? 0} accepted test cases are ready for UAT. UAT signs off the story revision in Huddle; Matrix records the signed-off revision.
              Automation continues in parallel and does not wait for sign-off.
            </p>
          )}
          {ws.uat === 'renewal' && <p className="secondary">The story or a test changed after sign-off. UAT must renew sign-off before export.</p>}
          {ws.uat === 'signed_off' && story.signoff && (
            <p className="secondary">
              Signed off by {story.signoff.userName}, {story.signoff.at}, at story rev {story.signoff.storyRevision}.
              Only signed-off tests at the signed-off revision go in the Octane import sheet. Downloading the sheet does not import anything into Octane.
            </p>
          )}
          <div className={styles.moveOn}>
            {ws.uat === 'signed_off' ? octaneButton(true) : (
              <>
                {(ws.uat === 'ready' || ws.uat === 'renewal') && (
                  <Link to={links.huddle({ ref: story._id })} className="btn">{ws.uat === 'renewal' ? 'Renew sign-off in Huddle' : 'Sign off in Huddle'}</Link>
                )}
                {octaneButton()}
              </>
            )}
            <DownloadButton label="Download test cases" onClick={openDownload} />
          </div>
        </section>
      ) : panelFor(shown)}

      <OctaneExportDialog
        open={octaneOpen}
        onClose={() => setOctaneOpen(false)}
        stories={[story]}
        context={context}
        snapshot={snapshot}
      />
    </div>
  );
}

function StoryPill({ ws }: { ws: StoryWorkspace }) {
  const { story } = ws;
  if (story.signoff?.changedAfterSignoff) return <Pill tone="warning">Changed after sign-off</Pill>;
  if (ws.uat === 'signed_off') return <Pill tone="success">Signed off</Pill>;
  if (ws.uat === 'ready') return <Pill>Ready for UAT sign-off</Pill>;
  const k = STAGE_ORDER.find((s) => ws.stages[s].status === 'needs_review');
  return k ? <Pill tone="outline">{STAGE_META[k].title} · needs review</Pill> : <Pill>Not started</Pill>;
}

const BranchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="5" r="2" />
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="9" r="2" />
    <path d="M6 7v10M18 11c0 4-6 3-12 6" />
  </svg>
);

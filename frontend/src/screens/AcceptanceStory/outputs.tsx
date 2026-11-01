import { useMemo, useState, type CSSProperties } from 'react';
import { DataTable, type Column } from '../../components/DataTable';
import { Chip, Pill } from '../../components/ui';
import { REJECTION_REASONS, type TestState } from '../../features/testcases';
import type {
  AutomationFile, AutomationOutput, AutomationTest, Citation, StoryAnalysis, TagSuggestion, TagVocabulary, TestCase,
} from './api';
import styles from './AcceptanceStory.module.css';

const anchor = (id: string) => `src-${id.replace(/[^a-zA-Z0-9]/g, '-')}`;

/** Inline citation links that jump to the source card below. */
function Cites({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <span className={styles.cites}>
      {ids.map((id) => (
        <a key={id} href={`#${anchor(id)}`} className={styles.citeLink}>[{id}]</a>
      ))}
    </span>
  );
}

export function Sources({ citations, title = 'Sources used' }: { citations: Citation[]; title?: string }) {
  return (
    <section className={styles.section} aria-label={title}>
      <h3>{title}</h3>
      <ul className={styles.sources}>
        {citations.map((c) => (
          <li key={c.id} id={anchor(c.id)} className={styles.source} tabIndex={-1}>
            <span className="row" style={{ '--gap': '6px' } as CSSProperties}>
              <Chip>{c.source}</Chip>
              {/* TODO(integration): deep link to the Jira field or Confluence chunk. */}
              <a href={c.url}>{c.label}</a>
            </span>
            <span className={styles.excerpt}>“{c.excerpt}”</span>
            <span className="mono small muted">{c.id}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AnalysisView({ analysis }: { analysis: StoryAnalysis }) {
  return (
    <>
      <section className={styles.section} aria-label="Refined summary">
        <h3>Refined summary</h3>
        <p style={{ lineHeight: 1.55 }}>{analysis.refinedSummary}</p>
      </section>
      <section className={styles.section} aria-label="Acceptance criteria, made testable">
        <h3>Acceptance criteria, made testable · {analysis.criteria.length}</h3>
        <ul className={styles.criteria}>
          {analysis.criteria.map((c) => (
            <li key={c.id} className={styles.criterion}>
              <span className="row" style={{ '--gap': '8px' } as CSSProperties}>
                <span className="mono small">{c.id}</span>
                <strong>{c.testable}</strong>
              </span>
              <span className={styles.original}>In Jira: “{c.original}”</span>
              <Cites ids={c.citations} />
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.section} aria-label="Ambiguities and questions">
        <h3>Ambiguities and questions · {analysis.questions.length}</h3>
        {analysis.questions.length === 0 ? (
          <span className="muted small">None found.</span>
        ) : (
          <ul className={styles.list}>
            {analysis.questions.map((q) => (
              <li key={q.id}><span className="mono small">{q.id}</span> {q.text} <Cites ids={q.citations} /></li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.section} aria-label="Out of scope">
        <h3>Out of scope</h3>
        <ul className={styles.list}>
          {analysis.outOfScope.map((o) => <li key={o}>{o}</li>)}
        </ul>
      </section>
      <Sources citations={analysis.citations} />
    </>
  );
}

const testsUnit = { one: 'test case', many: 'test cases' };
const STATE_TONE: Record<TestState, 'neutral' | 'success' | 'accent' | 'warning' | 'outline'> = {
  draft: 'neutral', accepted: 'success', rejected: 'accent', edited: 'outline', stale: 'warning',
};
const reasonLabel = (t: TestCase) => REJECTION_REASONS.find((r) => r.value === t.rejection?.reason)?.label;

export function TestCasesView({ tests, citations, onSelectionChange, onFilteredChange }: {
  tests: TestCase[];
  citations: Citation[];
  onSelectionChange: (ids: string[]) => void;
  onFilteredChange: (rows: TestCase[]) => void;
}) {
  const [openId, setOpenId] = useState<string>(tests[0]?._id ?? '');
  const open = tests.find((t) => t._id === openId);

  const columns = useMemo<Column<TestCase>[]>(() => [
    {
      key: 'id', header: 'ID', value: (t) => t._id, width: 130,
      render: (t) => (
        <button
          type="button"
          className={`link-btn ${styles.idBtn}`}
          aria-expanded={openId === t._id}
          aria-controls="tc-detail"
          onClick={() => setOpenId(t._id)}
        >
          {t._id}<span className="sr-only">: show steps</span>
        </button>
      ),
    },
    { key: 'title', header: 'Title', value: (t) => t.title },
    { key: 'criterion', header: 'Covers', value: (t) => t.criterionId, mono: true, filter: { type: 'select' }, width: 90 },
    { key: 'steps', header: 'Steps', value: (t) => t.steps.length, filter: { type: 'none' }, width: 70 },
    { key: 'needs', header: '@role / @data', value: (t) => [...t.roles, ...t.dataNeeds].join(' '), render: (t) => <span className="mono small">{[...t.roles, ...t.dataNeeds].join(' · ')}</span> },
    { key: 'state', header: 'State', value: (t) => t.state, filter: { type: 'select' }, render: (t) => (
        <span className="stack" style={{ '--gap': '2px' } as CSSProperties}>
          <Pill tone={STATE_TONE[t.state]}>{t.state}</Pill>
          {t.state === 'rejected' && reasonLabel(t) && <span className="small muted">{reasonLabel(t)}</span>}
        </span>
      ), width: 130 },
  ], [openId]);

  return (
    <>
      <div className={styles.tableFix}>
        <DataTable
          id="story-tests"
          title={<h3>Test cases</h3>}
          rows={tests}
          columns={columns}
          rowKey={(t) => t._id}
          rowLabel={(t) => `${t._id} ${t.title}`}
          activeRowKey={openId}
          selectable
          onSelectionChange={onSelectionChange}
          onFilteredChange={onFilteredChange}
          searchLabel="Search test cases"
          searchPlaceholder="Search by ID, title, criterion or @role"
          pageSizes={[10, 25]}
          noun={testsUnit}
          minWidth={780}
        />
      </div>
      {open && (
        <section id="tc-detail" className={styles.detail} aria-label={`Steps for ${open._id}`} aria-live="polite">
          <div className="spread">
            <h3><span className="mono">{open._id}</span> · {open.title}</h3>
            <span className="small muted">Covers {open.criterionId} · rev {open.revision} · {open.state}</span>
          </div>
          {open.state === 'rejected' && (
            <p className="small">Rejected in review: {reasonLabel(open)}{open.rejection?.note ? `. “${open.rejection.note}”` : ''}. Excluded when the set is accepted.</p>
          )}
          <div className="stack" style={{ '--gap': '4px' } as CSSProperties}>
            <span className="small secondary">Preconditions</span>
            <ul className={styles.list}>{open.preconditions.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
          <div className="stack" style={{ '--gap': '4px' } as CSSProperties}>
            <span className="small secondary">Steps and expected results</span>
            <ol className={styles.steps}>
              {open.steps.map((s) => (
                <li key={s.seq}>
                  {s.action}
                  <div className={styles.stepExpected}>Expected: {s.expected}</div>
                </li>
              ))}
            </ol>
          </div>
          <div className="row small" style={{ '--gap': '6px' } as CSSProperties}>
            <span className="secondary">Sources:</span>
            <Cites ids={open.citations} />
          </div>
        </section>
      )}
      <Sources citations={citations} title="Sources the test cases cite" />
    </>
  );
}

const filesUnit = { one: 'file', many: 'files' };
const autoTestsUnit = { one: 'test', many: 'tests' };

export function AutomationView({ automation }: { automation: AutomationOutput }) {
  const tests = automation.files.flatMap((f) => f.tests.map((t) => ({ ...t, file: f.path })));
  const fileCols = useMemo<Column<AutomationFile>[]>(() => [
    { key: 'path', header: 'File', value: (f) => f.path, mono: true, render: (f) => <span className="mono small" style={{ overflowWrap: 'anywhere' }}>{f.path}</span> },
    { key: 'change', header: 'Change', value: (f) => f.change, filter: { type: 'select' }, width: 100 },
    { key: 'lines', header: 'Lines', value: (f) => f.additions + f.deletions, filter: { type: 'none' }, render: (f) => <span className="mono small"><span style={{ color: 'var(--success-text)' }}>+{f.additions}</span> <span style={{ color: 'var(--danger-text)' }}>−{f.deletions}</span></span>, width: 100 },
    { key: 'tests', header: 'Tests', value: (f) => f.tests.length, filter: { type: 'none' }, width: 70 },
  ], []);
  const testCols = useMemo<Column<AutomationTest & { file: string }>[]>(() => [
    { key: 'name', header: 'Test method', value: (t) => t.name, mono: true },
    { key: 'tc', header: 'Test case', value: (t) => t.testCaseId, mono: true, width: 130 },
    { key: 'tags', header: 'Tags', value: (t) => t.tags.join(' '), render: (t) => <span className="mono small">{t.tags.map((g) => `@Tag("${g}")`).join(' ')}</span> },
  ], []);

  return (
    <>
      <section className={styles.section} aria-label="Pull request">
        <h3>Pull request</h3>
        <div className={styles.branch}>
          <span>Repository <span className="mono">{automation.repo}</span></span>
          <span>Branch <span className="mono">{automation.branch}</span> → <span className="mono">{automation.baseBranch}</span></span>
          {/* TODO(integration): GitHub PR link. */}
          <a href={automation.prUrl}>{automation.prNumber ? `PR #${automation.prNumber}` : 'PR opens when you accept'}</a>
        </div>
        <p className="small secondary">
          Code changes only through this pull request on a matrix/* branch; a person reviews and merges in GitHub.
          Matrix never runs tests: Harness runs them from Git after the PR opens or merges.
        </p>
      </section>
      <div className={styles.tableFix}>
        <DataTable id="story-files" title={<h3>Files changed</h3>} rows={automation.files} columns={fileCols} rowKey={(f) => f.path} noun={filesUnit} pageSizes={[10]} minWidth={640} searchLabel="Search files" />
      </div>
      <div className={styles.tableFix}>
        <DataTable id="story-autotests" title={<h3>Tagged tests</h3>} rows={tests} columns={testCols} rowKey={(t) => t.name + t.testCaseId} noun={autoTestsUnit} pageSizes={[10, 25]} minWidth={640} searchLabel="Search tagged tests" />
      </div>
      <section className={styles.section} aria-label="Code preview">
        <h3>Preview · first test</h3>
        <pre className={`code ${styles.preview}`} tabIndex={0} aria-label="Code preview of the first generated test">{automation.preview}</pre>
      </section>
    </>
  );
}

const tagsUnit = { one: 'test', many: 'tests' };

export function TaggingView({ suggestions, edits, vocab, readOnly, onChange }: {
  suggestions: TagSuggestion[];
  edits: TagSuggestion[];
  vocab: TagVocabulary;
  readOnly: boolean;
  onChange: (next: TagSuggestion[]) => void;
}) {
  const update = (id: string, patch: Partial<TagSuggestion>) =>
    onChange(edits.map((e) => (e.testCaseId === id ? { ...e, ...patch } : e)));

  const columns = useMemo<Column<TagSuggestion>[]>(() => {
    const original = (id: string) => suggestions.find((s) => s.testCaseId === id);
    const changed = (t: TagSuggestion) => {
      const o = original(t.testCaseId);
      return !!o && (o.priority !== t.priority || [...o.suites].sort().join() !== [...t.suites].sort().join());
    };
    return [
      { key: 'tc', header: 'Test case', value: (t) => t.testCaseId, mono: true, width: 120 },
      {
        key: 'suites', header: 'Suites', value: (t) => t.suites.join(' '),
        filter: { type: 'select', options: vocab.suites.map((s) => s.key), match: (t, v) => t.suites.includes(v) },
        render: (t) => readOnly ? (
          <span className="row" style={{ '--gap': '4px' } as CSSProperties}>{t.suites.map((s) => <Chip key={s}>{s}</Chip>)}</span>
        ) : (
          <fieldset className={styles.tagSet}>
            <legend className="sr-only">Suites for {t.testCaseId}</legend>
            {vocab.suites.map((s) => (
              <label key={s.key} className={styles.tagToggle} title={s.description}>
                <input
                  type="checkbox"
                  checked={t.suites.includes(s.key)}
                  onChange={(e) => update(t.testCaseId, { suites: e.target.checked ? [...t.suites, s.key] : t.suites.filter((x) => x !== s.key) })}
                />
                {s.label}
              </label>
            ))}
          </fieldset>
        ),
      },
      {
        key: 'priority', header: 'Priority', value: (t) => t.priority, filter: { type: 'select', options: vocab.priorities.map((p) => p.key) }, width: 150,
        render: (t) => readOnly ? <span className="mono">{t.priority}</span> : (
          <select className="select" aria-label={`Priority for ${t.testCaseId}`} value={t.priority} onChange={(e) => update(t.testCaseId, { priority: e.target.value })}>
            {vocab.priorities.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        ),
      },
      {
        key: 'reason', header: 'Why (AI)', value: (t) => t.reason,
        render: (t) => (
          <span className="small secondary">
            {original(t.testCaseId)?.reason}
            {changed(t) && <span className={styles.changed}> · changed by you</span>}
          </span>
        ),
      },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, edits, vocab, readOnly]);

  return (
    <div className={styles.tableFix}>
      <DataTable
        id="story-tags"
        title={<h3>Suggested tags</h3>}
        rows={edits}
        columns={columns}
        rowKey={(t) => t.testCaseId}
        noun={tagsUnit}
        pageSizes={[10, 25]}
        minWidth={860}
        searchLabel="Search tags"
        searchPlaceholder="Search by test case, tag or reason"
      />
    </div>
  );
}

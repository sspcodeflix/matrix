// Reference: design/html/Main.html (standalone landing page, no AppShell)
import { Link } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { Icon, MatrixLogo } from '../../components/Icon';
import { useTheme } from '../../theme/ThemeContext';
import { fetchLandingPreview, type LandingPreview, type PreviewStatus } from './api';
import styles from './Landing.module.css';

const ACRONYM: [string, string][] = [
  ['M', 'ulti-'], ['A', 'gent '], ['T', 'esting, '], ['R', 'easoning, '], ['I', 'ntelligence & e'], ['X', 'ecution'],
];

const PROBLEMS = [
  { source: 'Confluence · Knowledge OS', title: 'Requirements', body: 'Written by product owners and business analysts. Rarely linked to a test, and never to the automation that would prove them.' },
  { source: 'Octane', title: 'Test cases', body: 'Maintained by QA. Mapped back to requirements only when someone remembers, so coverage numbers describe effort, not functionality.' },
  { source: 'GitHub · Harness · HyperExecute', title: 'Automation', body: 'Owned by SDETs. Runs green every night, and nobody can say which business requirements it actually exercises.' },
];

const WORKFLOWS = [
  {
    eyebrow: 'Acceptance',
    title: 'Test what this release changes',
    body: 'Turns the Jira stories in a release into acceptance tests your UAT users can sign off.',
    startsFrom: 'A Jira release or sprint',
    steps: [
      ['Pull stories', 'Reads every story and its acceptance criteria from the Jira fix version.'],
      ['Understand', 'Links each criterion to the app context in Knowledge OS and DocuMind, and flags stories with no criteria.'],
      ['Write tests', 'Writes functional test cases for every acceptance criterion, for QA to review.'],
      ['Sign off and export', 'UAT signs off story by story; signed-off tests export as the Octane import sheet.'],
    ],
    output: 'Reviewed acceptance tests per story, signed off by UAT',
  },
  {
    eyebrow: 'Regression',
    title: 'Protect everything that already works',
    body: 'Scans the whole application, finds every gap in coverage and automation, and closes it.',
    startsFrom: 'An application in Knowledge OS',
    steps: [
      ['Understand', 'Loads the full application context: functional requirements from Knowledge OS and DocuMind.'],
      ['Identify gaps', 'Maps each requirement to Octane and the automation repo: no test, not automated, or stale.'],
      ['Write automation', 'Writes the missing automation and opens a pull request on a branch for review.'],
      ['Execute', 'The Harness pipeline runs it on HyperExecute, and results flow back into Octane.'],
    ],
    output: 'Automation in a PR, executed, with results in Octane',
  },
];

const INTEGRATIONS = ['Knowledge OS', 'DocuMind', 'Confluence', 'Jira', 'Octane', 'HyperExecute', 'Harness', 'GitHub', 'Tachyon (Gemini)', 'MLflow', 'MongoDB', 'Grafana'];

const PERSONAS = [
  ['QA engineers', 'Run gap analysis per release, review the written test cases, and push them to Octane.'],
  ['UAT users', 'See which business flows are covered in plain language, and sign off with evidence rather than a status email.'],
  ['Dev teams', 'Receive a pull request with the missing automation on a branch, and the run results in Octane once the pipeline finishes.'],
];

const GOVERNANCE = [
  ['SSO sign-in', 'Enterprise identity, per-user permissions, no separate credentials.'],
  ['Bring your own Tachyon license', "Model calls run on your team's own gateway allocation, so cost sits with the team that uses it."],
  ['Branches and pull requests only', 'Generated automation never touches main. A human merges, every time.'],
  ['Traced and audited', 'Prompts, evals and traces in MLflow; audit records and checkpoints in MongoDB.'],
];

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

export default function LandingScreen() {
  const theme = useTheme();
  const preview = useApi(fetchLandingPreview);
  const toDark = theme.resolved !== 'dark';

  return (
    <div className={styles.page}>
      <a href="#main" className={styles.skip}>Skip to content</a>
      <header className={styles.header}>
        <div className={`${styles.wrap} ${styles.headerInner}`}>
          <div className="row" style={{ gap: 12 }}>
            <MatrixLogo size={28} />
            <span className={styles.brand}>Matrix</span>
            <span className={styles.tag}>Quality Engineering</span>
          </div>
          <nav aria-label="Primary" className={styles.nav}>
            <a href="#how">How it works</a>
            <a href="#integrations">Integrations</a>
            <a href="#trust">Governance</a>
          </nav>
          <div className="row" style={{ gap: 10 }}>
            <button
              type="button"
              className="btn icon"
              aria-label={toDark ? 'Switch to dark theme' : 'Switch to light theme'}
              title={toDark ? 'Switch to dark theme' : 'Switch to light theme'}
              onClick={theme.toggle}
            >
              <Icon name={toDark ? 'moon' : 'sun'} />
            </button>
            {/* TODO: link to the product documentation once it is published. */}
            <a href="#docs" className={`btn ${styles.plainBtn}`}>Docs</a>
            {/* TODO(backend): SSO sign-in flow; for now this opens the app. */}
            <Link to="/overview" className="btn primary">Sign in with SSO</Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className={styles.hero}>
          <div className={`${styles.wrap} ${styles.heroInner}`}>
            <div className={styles.heroCopy}>
              <span className={styles.acronym}>
                {ACRONYM.map(([l, rest]) => (
                  <span key={l}><span className={styles.acronymLetter}>{l}</span>{rest}</span>
                ))}
              </span>
              <h1 className={styles.heroTitle}>Finds the gaps.<br />Writes the tests.<br />Tracks every run.</h1>
              <p className={styles.lead}>
                Matrix maps every functional requirement in your application context to the tests in Octane and the automation in
                Git, identifies what is missing, writes the test cases and automation that close each gap, and opens a pull request
                for review. Your Harness pipeline runs the tests on HyperExecute when the PR is opened or merged, and Matrix tracks
                the results back to each requirement. One workspace, from requirement to run result.
              </p>
              <div className="row" style={{ gap: 12 }}>
                <Link to="/overview" className={`btn primary ${styles.bigBtn}`}>Open workspace <ArrowRight /></Link>
                <a href="#how" className={`btn ${styles.bigBtn}`}>See how it works</a>
              </div>
              <div className={styles.facts}>
                <span>SSO sign-in</span><span aria-hidden="true">·</span>
                <span>Bring your own Tachyon license</span><span aria-hidden="true">·</span>
                <span>Automation lands as a PR, never on main</span>
              </div>
            </div>
            <div className={styles.heroVisual}>
              {preview.data && <Preview data={preview.data} />}
            </div>
          </div>
        </section>

        <section className={styles.band}>
          <div className={`${styles.wrap} ${styles.sectionInner}`}>
            <div className={styles.intro}>
              <span className={styles.eyebrow}>The problem</span>
              <h2 className={styles.h2}>Nobody owns the end-to-end view of functional coverage.</h2>
              <p className={styles.sub}>Requirements, test cases and automation each live in a system that is complete on its own. The gaps live between them, and today they are found by hand, late, or in production.</p>
            </div>
            <div className={styles.cards3}>
              {PROBLEMS.map((p) => (
                <div key={p.title} className={styles.redCard}>
                  <span className="eyebrow">{p.source}</span>
                  <h3 className={styles.h3}>{p.title}</h3>
                  <p className={styles.body}>{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className={`${styles.band} ${styles.subtle}`}>
          <div className={`${styles.wrap} ${styles.sectionInner}`}>
            <div className={styles.intro}>
              <span className={styles.eyebrow}>How it works</span>
              <h2 className={styles.h2}>Two workflows. One for what is changing, one for everything that already works.</h2>
              <p className={styles.sub}>Matrix is deterministic where it can be and uses the model only where judgment is needed. Every step leaves a trace you can inspect.</p>
            </div>
            <div className={styles.cards2}>
              {WORKFLOWS.map((w) => (
                <div key={w.eyebrow} className={`${styles.redCard} ${styles.workflow}`}>
                  <div className="stack" style={{ gap: 8 }}>
                    <span className="eyebrow">{w.eyebrow}</span>
                    <h3 className={styles.workflowTitle}>{w.title}</h3>
                    <p className={styles.body}>{w.body}</p>
                  </div>
                  <div className={styles.startsFrom}>
                    <span className="eyebrow">Starts from</span>
                    <span style={{ fontWeight: 500 }}>{w.startsFrom}</span>
                  </div>
                  <ol className={styles.steps}>
                    {w.steps.map(([t, d], i) => (
                      <li key={t}>
                        <span className={styles.stepNum}>{String(i + 1).padStart(2, '0')}</span>
                        <span className="stack" style={{ gap: 4 }}>
                          <span className={styles.stepTitle}>{t}</span>
                          <span className={styles.stepBody}>{d}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className={styles.output}>
                    <span className="eyebrow">Output</span>&nbsp;&nbsp;{w.output}
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.connect}>
              <span style={{ color: 'var(--accent-text)', display: 'inline-flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" /></svg>
              </span>
              <span>
                <strong style={{ color: 'var(--text)' }}>The two connect.</strong> When a release ships, its signed-off acceptance tests
                join the regression suite, and the regression workflow writes their automation. Both share Huddle, where the team
                reviews and overrides what Matrix inferred, with a record of who changed what.
              </span>
            </div>
          </div>
        </section>

        <section id="integrations" className={`${styles.band} ${styles.subtle} ${styles.topBorder}`}>
          <div className={`${styles.wrap} ${styles.sectionInner}`} style={{ paddingBlock: 72, gap: 28 }}>
            <div className={styles.integrationsHead}>
              <div className={styles.intro} style={{ gap: 10 }}>
                <span className={styles.eyebrow}>Integrations</span>
                <h2 className={styles.h2s}>Works with the tools you already run.</h2>
              </div>
              <p className={styles.body} style={{ maxWidth: 420 }}>Connect GitHub and Jira with your own personal access token. Telemetry goes to the observability platform and Grafana dashboards you already have.</p>
            </div>
            <ul className={styles.integrations} aria-label="Integrations">
              {INTEGRATIONS.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </div>
        </section>

        <section className={`${styles.band} ${styles.topBorder}`}>
          <div className={`${styles.wrap} ${styles.sectionInner}`} style={{ gap: 36 }}>
            <div className={styles.intro} style={{ gap: 10 }}>
              <span className={styles.eyebrow}>Built for</span>
              <h2 className={styles.h2s}>Three personas, one source of truth.</h2>
            </div>
            <div className={styles.cards3}>
              {PERSONAS.map(([t, d]) => (
                <div key={t} className={styles.persona}>
                  <h3 className={styles.h3s}>{t}</h3>
                  <p className={styles.body}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="trust" className={`${styles.band} ${styles.subtle}`}>
          <div className={`${styles.wrap} ${styles.sectionInner}`} style={{ gap: 36 }}>
            <div className={styles.intro} style={{ gap: 10 }}>
              <span className={styles.eyebrow}>Governance</span>
              <h2 className={styles.h2s}>Nothing happens that you cannot inspect or reverse.</h2>
            </div>
            <div className={styles.cards4}>
              {GOVERNANCE.map(([t, d]) => (
                <div key={t} className={styles.rule}>
                  <h3 className={styles.h3m}>{t}</h3>
                  <p className={styles.small}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.cta}>
          <div className={`${styles.wrap} ${styles.ctaInner}`}>
            <div className="stack" style={{ gap: 12, maxWidth: 640 }}>
              <h2 className={styles.h2}>Start with one application.</h2>
              <p className={styles.ctaText}>Pick an application that is already in Knowledge OS, run gap analysis for its next release, and let Matrix write what your suite misses. Your pipeline runs it; Matrix shows the results.</p>
            </div>
            <Link to="/overview" className={styles.ctaBtn}>Open workspace <ArrowRight /></Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.footerInner}`}>
          <div className="row" style={{ gap: 10 }}>
            <MatrixLogo size={18} />
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>Matrix</span>
            <span>Multi-Agent Testing, Reasoning, Intelligence &amp; eXecution · an internal GenAI platform product</span>
          </div>
          {/* TODO: real Docs, Changelog and Support destinations. */}
          <nav aria-label="Footer" className="row" style={{ gap: 20 }}>
            <a href="#docs">Docs</a>
            <a href="#changelog">Changelog</a>
            <a href="#support">Support</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

const STATUS: Record<PreviewStatus, { label: string; className: string }> = {
  no_test: { label: 'No test', className: 'pill tone-accent' },
  not_automated: { label: 'Not automated', className: 'pill' },
  covered: { label: 'Covered', className: 'pill tone-success' },
};

/** Illustrative product preview in the hero. */
function Preview({ data }: { data: LandingPreview }) {
  const k = data.kpis;
  const kpis: [number, string, string | undefined][] = [
    [k.requirements, 'Requirements', undefined],
    [k.covered, 'Covered', 'var(--success-text)'],
    [k.noTest, 'No test', 'var(--danger-text)'],
    [k.notAutomated, 'Not automated', undefined],
  ];
  return (
    <figure className={styles.preview} aria-label="Example of the Matrix regression workspace">
      <div className={styles.previewHead}>
        <div className="row" style={{ gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{data.application}</span>
          <span className="muted" style={{ fontSize: 13 }}>{data.release}</span>
        </div>
        <span className={styles.synced}><span className="dot" style={{ width: 6, height: 6, background: 'var(--success)' }} />{data.syncLabel}</span>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.kpis}>
          {kpis.map(([v, l, c]) => (
            <div key={l} className={styles.kpi}>
              <span className={styles.kpiValue} style={{ color: c }}>{v}</span>
              <span className="small muted">{l}</span>
            </div>
          ))}
        </div>
        <table className={styles.miniTable}>
          <thead>
            <tr><th scope="col">Requirement</th><th scope="col">Octane</th><th scope="col">Status</th></tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td className={styles.ellipsis}>{r.id} {r.title}</td>
                <td className="muted">{r.octaneCases} {r.octaneCases === 1 ? 'case' : 'cases'}</td>
                <td><span className={STATUS[r.status].className}>{STATUS[r.status].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row">
          <Link to="/regression" className={`btn primary ${styles.smallBtn}`}>Write tests for {k.noTest} gaps</Link>
          <Link to="/regression" className={`btn ${styles.smallBtn}`}>Generate automation for {k.notAutomated}</Link>
        </div>
      </div>
    </figure>
  );
}

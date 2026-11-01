import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useApi } from '../../api/useApi';
import { DataTable, type Column, type TableView } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { DownloadButton, ErrorState, Loading, PageHeader, Pill } from '../../components/ui';
import { useDownloadReport } from '../../features/download/DownloadReportContext';
import { filterSpec } from '../../features/download/types';
import { fetchSkills, type Skill, type SkillsData } from './api';
import styles from './Skills.module.css';

const skillUnit = { one: 'skill', many: 'skills' };

export default function SkillsScreen() {
  const { data, error, loading } = useApi(fetchSkills);
  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <Loading label="Loading skills" />;
  return <Skills data={data} />;
}

function PassBar({ value, gate }: { value: number; gate: number }) {
  const below = value < gate;
  return (
    <span className="row" style={{ '--gap': '8px', flexWrap: 'nowrap' } as CSSProperties}>
      <span className={styles.bar} aria-hidden="true">
        <span style={{ width: `${value}%`, background: below ? 'var(--accent)' : 'var(--success)' }} />
      </span>
      <span className="mono small">{value}%</span>
      {below && <span className="sr-only">below the {gate}% gate</span>}
    </span>
  );
}

function StatusPill({ skill, gate }: { skill: Skill; gate: number }) {
  if (skill.status === 'proposed') return <Pill tone="accent">1 proposed change</Pill>;
  if (skill.status === 'draft') {
    return skill.evalPassRate < gate ? <Pill tone="warning">Draft, below gate</Pill> : <Pill tone="warning">Draft</Pill>;
  }
  return <Pill tone="success">Live</Pill>;
}

const statusLabel = (s: Skill, gate: number) =>
  s.status === 'proposed' ? 'Proposed change' : s.status === 'draft' ? (s.evalPassRate < gate ? 'Draft, below gate' : 'Draft') : 'Live';

function Skills({ data }: { data: SkillsData }) {
  const { gate } = data;
  const download = useDownloadReport();
  const [skills, setSkills] = useState<Skill[]>(data.skills);
  const [selectedName, setSelectedName] = useState<string>(
    () => (data.skills.find((s) => s.proposal) ?? data.skills[0])?.name ?? '',
  );
  const [filtered, setFiltered] = useState<Skill[]>(data.skills);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const selected = skills.find((s) => s.name === selectedName);

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => {
      setRunning(false);
      setNotice(`Evals finished on golden datasets for ${skills.length} skills. Results are logged to MLflow.`);
    }, 1400);
    return () => clearTimeout(t);
  }, [running, skills.length]);

  const columns = useMemo<Column<Skill>[]>(
    () => [
      {
        key: 'name', header: 'Skill', value: (s) => `${s.name} ${s.owner}`,
        render: (s) => (
          <button
            type="button"
            className={styles.nameBtn}
            aria-pressed={s.name === selectedName}
            onClick={() => setSelectedName(s.name)}
          >
            {s.name}
            <span className="sr-only">, owner {s.owner}, show details</span>
          </button>
        ),
      },
      { key: 'type', header: 'Type', value: (s) => s.type, filter: { type: 'select' } },
      { key: 'version', header: 'Version', value: (s) => s.version, mono: true },
      { key: 'apps', header: 'Apps', value: (s) => s.apps, filter: { type: 'select' } },
      {
        key: 'rate', header: 'Eval pass rate', value: (s) => s.evalPassRate, filter: { type: 'none' },
        render: (s) => <PassBar value={s.evalPassRate} gate={gate} />,
      },
      {
        key: 'status', header: 'Status', value: (s) => statusLabel(s, gate), filter: { type: 'select' },
        render: (s) => <StatusPill skill={s} gate={gate} />,
      },
    ],
    [gate, selectedName],
  );

  const views = useMemo<TableView<Skill>[]>(
    () => [
      { key: 'all', label: 'All', match: () => true },
      { key: 'below', label: `Below gate (${gate}%)`, match: (s) => s.evalPassRate < gate },
      { key: 'proposed', label: 'Proposed changes', match: (s) => s.status === 'proposed' },
    ],
    [gate],
  );

  const openDownload = () =>
    download.open({
      context: `Skills · ${data.appName}`,
      reportTypes: [
        {
          key: 'skill-eval',
          label: 'Skill evaluation',
          description: 'Exact skill commits, dataset versions, live versus proposed results, checks and gate outcome.',
          formats: ['pdf', 'html', 'xlsx'],
        },
      ],
      scope: {
        selected: { count: selected ? 1 : 0, unit: skillUnit, ids: selected ? [selected.name] : undefined },
        filtered: { count: filtered.length, unit: skillUnit, spec: filterSpec({ rows: filtered.map((s) => s.name).sort().join(',') }) },
        full: { count: skills.length, unit: skillUnit },
      },
      snapshot: data.snapshot,
      snapshotCapturedAt: data.snapshotCapturedAt,
      snapshotId: data.snapshotId,
      comparison: `Promotion gate: ${gate}% on golden datasets`,
    });

  const promote = () => {
    if (!selected?.proposal) return;
    const p = selected.proposal;
    setSkills((list) =>
      list.map((s) =>
        s.name === selected.name ? { ...s, version: p.toVersion, evalPassRate: p.passRate, status: 'live', proposal: undefined } : s,
      ),
    );
    setConfirmOpen(false);
    // TODO(backend): POST /api/skills/{name}/promote; recorded in the audit log.
    setNotice(`${selected.name} ${p.toVersion} is now live. The promotion is recorded in the audit log.`);
  };

  return (
    <div className="page">
      <PageHeader
        title={
          <span className="row" style={{ '--gap': '10px' } as CSSProperties}>
            Skills
            <span title="Admin only" style={{ display: 'inline-flex', opacity: 0.75 }}>
              <Icon name="lock" size={20} strokeWidth={2.2} label="Admin only" />
            </span>
          </span>
        }
        subtitle="How Matrix writes tests and automation · visible to admins"
        actions={
          <>
            <DownloadButton onClick={openDownload} />
            <button type="button" className="btn" disabled={running} onClick={() => { setNotice(null); setRunning(true); }}>
              {running ? 'Running evals…' : 'Run evals'}
            </button>
            <button type="button" className="btn primary" aria-haspopup="dialog" onClick={() => setAddOpen(true)}>
              Add skill
            </button>
          </>
        }
      />

      <div aria-live="polite">
        {running && (
          <div className="banner" role="status">
            <Icon name="info" />
            <span>Running evals for {skills.length} skills on golden datasets in the Matrix sandbox…</span>
          </div>
        )}
        {notice && (
          <div className="banner success" role="status">
            <Icon name="check" />
            <span className="grow">{notice}</span>
            <button type="button" className="link-btn" style={{ minHeight: 0 }} onClick={() => setNotice(null)}>Dismiss</button>
          </div>
        )}
      </div>

      <div className="split">
        <div className="main-col">
          <DataTable
            id="skills"
            title="Library"
            rows={skills}
            columns={columns}
            rowKey={(s) => s.name}
            views={views}
            searchLabel="Search skills"
            searchPlaceholder="Search by skill name or owner"
            onFilteredChange={setFiltered}
            pageSizes={[6, 25, 50]}
            minWidth={700}
            noun={skillUnit}
            actions={<span className="small muted">Promotion gate: {gate}% on golden datasets</span>}
          />
        </div>
        <div className="side-col">
          {selected ? (
            <SkillDetail skill={selected} gate={gate} onDiff={() => setDiffOpen(true)} onPromote={() => setConfirmOpen(true)} />
          ) : (
            <section className="card card-pad muted">Select a skill to see its versions and evals.</section>
          )}
        </div>
      </div>

      {selected?.proposal && (
        <>
          <Dialog
            open={diffOpen}
            onClose={() => setDiffOpen(false)}
            title={`${selected.name}: ${selected.proposal.fromVersion} to ${selected.proposal.toVersion}`}
            subtitle={`SKILL.md · proposed from ${selected.proposal.rejectionCount} review rejections`}
            width={760}
          >
            <pre className="code" aria-label="Changes to SKILL.md" style={{ whiteSpace: 'pre-wrap' }}>
              {selected.proposal.diff.map((d, i) => (
                <span key={i} className={d.op === 'add' ? 'diff-add' : d.op === 'del' ? 'diff-del' : undefined} style={d.op === 'same' ? { display: 'block' } : undefined}>
                  {d.op === 'add' ? '+ ' : d.op === 'del' ? '- ' : '  '}
                  {d.text}
                </span>
              ))}
            </pre>
          </Dialog>
          <Dialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title={`Promote ${selected.name} ${selected.proposal.toVersion}?`}
            width={520}
            footer={
              <>
                <button type="button" className="btn" onClick={() => setConfirmOpen(false)}>Cancel</button>
                <button type="button" className="btn dark" onClick={promote}>Promote {selected.proposal.toVersion}</button>
              </>
            }
          >
            <p className="secondary">
              {selected.proposal.toVersion} passed {selected.proposal.passRate}% on golden datasets (gate {gate}%). It becomes the live
              version for {selected.apps} {selected.apps === 1 ? 'app' : 'apps'} that pin "live". Apps pinned to {selected.proposal.fromVersion} keep it until they update.
            </p>
          </Dialog>
        </>
      )}

      <AddSkillDialog open={addOpen} onClose={() => setAddOpen(false)} onRequested={(name) => setNotice(`A pull request to add ${name} was requested on matrix-skills. It appears here after merge and Sync from Git.`)} />
    </div>
  );
}

function SkillDetail({ skill, gate, onDiff, onPromote }: { skill: Skill; gate: number; onDiff: () => void; onPromote: () => void }) {
  const p = skill.proposal;
  const gatePasses = p ? p.passRate >= gate : false;
  return (
    <section className="card card-pad stack" aria-labelledby="skd-heading">
      <div className="spread" style={{ gap: 8 }}>
        <h2 id="skd-heading" style={{ fontSize: 14 }}>{skill.name}</h2>
        <span className={styles.tag}>{skill.version} {skill.status === 'draft' ? 'draft' : 'live'}</span>
      </div>
      <p className="secondary" style={{ fontSize: 13 }}>
        {skill.description} Owner: {skill.owner} · Source: {skill.source}
      </p>

      {p ? (
        <>
          <div className={styles.proposal}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Proposed {p.toVersion} · from {p.rejectionCount} review rejections
            </span>
            <p className="secondary" style={{ fontSize: 13 }}>{p.text}</p>
            <span className="row" style={{ '--gap': '6px' } as CSSProperties}>
              {p.evidence.map((e) => (
                <span key={e.label} className={styles.tag}>{e.label} × {e.count}</span>
              ))}
            </span>
          </div>
          <table className={styles.evals}>
            <thead>
              <tr>
                <th scope="col">Eval on golden dataset</th>
                <th scope="col">{p.fromVersion}</th>
                <th scope="col">{p.toVersion}</th>
              </tr>
            </thead>
            <tbody>
              {p.evals.map((e) => (
                <tr key={e.check}>
                  <td>{e.check}</td>
                  <td className="mono">{e.current}%</td>
                  <td className="mono" style={{ fontWeight: 500, color: e.proposed === null ? 'var(--text-muted)' : e.proposed >= e.current ? 'var(--success-text)' : 'var(--danger-text)' }}>
                    {e.proposed === null ? 'pending' : `${e.proposed}%`}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 600 }}>Overall pass rate</td>
                <td className="mono">{skill.evalPassRate}%</td>
                <td className="mono" style={{ fontWeight: 600, color: gatePasses ? 'var(--success-text)' : 'var(--danger-text)' }}>{p.passRate}%</td>
              </tr>
            </tbody>
          </table>
          <p id="promote-reason" className="small muted">
            {gatePasses
              ? `${p.toVersion} meets the ${gate}% promotion gate.`
              : `Promote is unavailable: ${p.toVersion} scores ${p.passRate}%, below the ${gate}% gate.`}
          </p>
          <div className="row">
            <button type="button" className="btn" aria-haspopup="dialog" onClick={onDiff}>View diff</button>
            <button type="button" className="btn primary" aria-haspopup="dialog" disabled={!gatePasses} aria-describedby="promote-reason" onClick={onPromote}>
              Promote {p.toVersion}
            </button>
          </div>
        </>
      ) : (
        <div className="stack" style={{ '--gap': '8px' } as CSSProperties}>
          <div className="spread">
            <span className="small muted">Eval pass rate vs {gate}% gate</span>
            <PassBar value={skill.evalPassRate} gate={gate} />
          </div>
          <p className="small muted">
            {skill.evalPassRate < gate
              ? `Below the gate: this version cannot go live until evals reach ${gate}%.`
              : 'No proposed version. Proposals appear here when review rejections point to a change in this skill.'}
          </p>
        </div>
      )}
    </section>
  );
}

function AddSkillDialog({ open, onClose, onRequested }: { open: boolean; onClose: () => void; onRequested: (name: string) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Framework');
  const valid = /^[a-z0-9][a-z0-9-]{2,}$/.test(name);
  const submit = () => {
    if (!valid) return;
    // TODO(backend): POST /api/skills/scaffold opens a PR on matrix-skills (matrix/* branch); a person merges it.
    onRequested(name);
    setName('');
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add skill"
      subtitle="Skills live in the matrix-skills repo. Matrix opens a pull request with a scaffold; it goes live after evals pass the gate."
      width={560}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn dark" disabled={!valid} onClick={submit}>Open PR on matrix-skills</button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <label htmlFor="new-skill-name">Skill name</label>
          <input id="new-skill-name" className="input mono" value={name} placeholder="e.g. my-app-conventions" aria-describedby="new-skill-hint" onChange={(e) => setName(e.target.value.trim())} />
          <span id="new-skill-hint" className="small muted">Lowercase letters, numbers and hyphens.</span>
        </div>
        <div className="field">
          <label htmlFor="new-skill-type">Type</label>
          <select id="new-skill-type" className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option>Framework</option>
            <option>App</option>
          </select>
        </div>
      </div>
    </Dialog>
  );
}

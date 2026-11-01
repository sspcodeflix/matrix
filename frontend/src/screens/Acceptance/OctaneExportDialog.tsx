import { useState, type CSSProperties } from 'react';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { Pill } from '../../components/ui';
import { useWorkspace } from '../../workspace/useWorkspace';
import { generateOctaneSheet, type Story } from './api';

type Phase = 'preview' | 'generating' | 'ready' | 'downloaded';

/**
 * Export Octane import sheet: separate from Download report (docs/REPORTS.md). Only signed-off
 * stories at their signed-off revision are eligible; everything else is listed with a reason.
 * The sheet targets the Octane workspace of the workspace selected at the top right.
 */
export function OctaneExportDialog({ open, onClose, stories, context, snapshot }: {
  open: boolean;
  onClose: () => void;
  stories: Story[];
  context: string;
  snapshot: string;
}) {
  const [phase, setPhase] = useState<Phase>('preview');
  const [fileName, setFileName] = useState('');
  const { current: workspace } = useWorkspace();
  // Acceptance works inside one workspace; its Octane workspace is the import target.
  const octaneWorkspace = workspace?.octane.workspaceId;

  const eligible = stories.filter((s) => s.status === 'signed_off' && s.signoff && !s.signoff.changedAfterSignoff);
  const excluded = stories
    .filter((s) => !eligible.includes(s))
    .map((s) => ({
      story: s,
      reason: s.signoff?.changedAfterSignoff
        ? `Changed after sign-off (now rev ${s.revision}, signed off at rev ${s.signoff.storyRevision}). Needs renewed sign-off.`
        : 'Not signed off by UAT yet.',
    }));

  const testCount = eligible.reduce((n, st) => n + st.testCount, 0);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const close = () => {
    onClose();
    setPhase('preview');
  };

  const generate = async () => {
    setPhase('generating');
    const res = await generateOctaneSheet(octaneWorkspace!, eligible.map((st) => st._id));
    setFileName(res.fileName);
    setPhase('ready');
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Export Octane import sheet"
      subtitle={`${context} · ${snapshot}`}
      width={720}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end', width: '100%' }}>
          <button type="button" className="btn" onClick={close}>Close</button>
          {phase === 'preview' || phase === 'generating' ? (
            <button type="button" className="btn primary" disabled={!octaneWorkspace || eligible.length === 0 || phase === 'generating'} onClick={generate}>
              {phase === 'generating' ? 'Generating…' : `Generate sheet for ${plural(testCount, 'test', 'tests')}`}
            </button>
          ) : (
            // TODO(backend): stream the file from GET /api/exports/{id}/download.
            <button type="button" className="btn primary" onClick={() => setPhase('downloaded')}>
              <Icon name="download" size={16} strokeWidth={2} />
              Download {fileName}
            </button>
          )}
        </div>
      }
    >
      <div className="stack" style={{ padding: '16px 20px' }}>
        <p className="secondary">
          Uses the Octane import template, not the general test-case workbook. Each story exports at its signed-off revision.
          Exporting does not import anything into Octane.
        </p>

        {phase === 'ready' && <div className="banner success" role="status">Ready to download.</div>}
        {phase === 'downloaded' && (
          <div className="banner success" role="status">
            <Icon name="check" />
            <span>Sheet downloaded. Manual import into Octane remains.</span>
          </div>
        )}

        {octaneWorkspace ? (
          <p className="small">
            Target: Octane workspace <strong className="mono">{octaneWorkspace}</strong>, the workspace selected at the top right.
          </p>
        ) : (
          <div className="banner warning" role="status">Choose a workspace at the top right. Each workspace has its own Octane workspace, so the sheet needs one.</div>
        )}

        <section className="stack" style={{ '--gap': '6px' } as CSSProperties} aria-labelledby="oct-included">
          <h3 id="oct-included">Included · {plural(eligible.length, 'story', 'stories')}, {plural(testCount, 'test', 'tests')}</h3>
          {eligible.length === 0 ? (
            <span className="muted">No stories are signed off at their current revision, so there is nothing to export yet.</span>
          ) : (
            <ul className="stack" style={{ '--gap': '4px', margin: 0, paddingLeft: 18 } as CSSProperties}>
              {eligible.map((st) => (
                <li key={st._id}>
                  <span className="mono">{st._id}</span> rev {st.signoff!.storyRevision} · {plural(st.testCount, 'test', 'tests')} · signed off by {st.signoff!.userName}, {st.signoff!.at}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="stack" style={{ '--gap': '6px' } as CSSProperties} aria-labelledby="oct-excluded">
          <h3 id="oct-excluded">Excluded · {plural(excluded.length, 'story', 'stories')}</h3>
          <ul className="stack" style={{ '--gap': '4px', margin: 0, paddingLeft: 18 } as CSSProperties}>
            {excluded.map(({ story, reason }) => (
              <li key={story._id}>
                <span className="mono">{story._id}</span> · {reason}{' '}
                {story.signoff?.changedAfterSignoff && <Pill tone="warning">Changed after sign-off</Pill>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Dialog>
  );
}

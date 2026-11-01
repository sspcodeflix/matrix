import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '../components/Dialog';
import type { Workspace } from '../api/session';
import { useWorkspace } from './useWorkspace';

/**
 * Shown after sign-in until the user has chosen a workspace once. The choice sets the
 * application and workspace, and the Overview opens on that application's portfolio (CIO view).
 */
export function WorkspacePrompt({ allWorkspaces }: { allWorkspaces: Workspace[] }) {
  const { applications, application, isSet, choose } = useWorkspace();
  const [later, setLater] = useState(false);
  const [value, setValue] = useState(`${application.id}|*`);
  const navigate = useNavigate();

  const confirm = () => {
    const [appId, ws] = value.split('|');
    choose(appId, ws === '*' ? null : ws);
    navigate('/overview');
  };

  return (
    <Dialog
      open={!isSet && !later}
      onClose={() => setLater(true)}
      title="Choose your workspace"
      subtitle="You can change it any time at the top right."
      width={560}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end', width: '100%' }}>
          <button type="button" className="btn" onClick={() => setLater(true)}>Decide later</button>
          <button type="button" className="btn primary" onClick={confirm}>Continue</button>
        </div>
      }
    >
      <div className="stack" style={{ padding: '16px 20px', '--gap': '16px' } as CSSProperties}>
        <p className="secondary">
          Matrix opens on the portfolio (CIO) view for your application. Regression covers the whole application;
          Acceptance works inside one workspace.
        </p>
        {applications.map((app) => (
          <fieldset key={app.id} className="stack" style={{ border: 0, padding: 0, margin: 0, '--gap': '2px' } as CSSProperties}>
            <legend className="field-label" style={{ marginBottom: 6 }}>
              {app.name} <span className="mono muted">{app.id}</span>
            </legend>
            {[{ id: '*', label: 'All workspaces' }, ...allWorkspaces.filter((w) => w.appId === app.id).map((w) => ({ id: w.id, label: w.id }))].map((o) => (
              <label key={o.id} className="row" style={{ minHeight: 44, gap: 10 }}>
                <input
                  type="radio"
                  name="workspace-choice"
                  value={`${app.id}|${o.id}`}
                  checked={value === `${app.id}|${o.id}`}
                  onChange={(e) => setValue(e.target.value)}
                  style={{ width: 18, height: 18 }}
                />
                <span className={o.id === '*' ? undefined : 'mono'}>{o.label}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
    </Dialog>
  );
}

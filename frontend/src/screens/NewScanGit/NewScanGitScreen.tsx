// Reference: design/html/NewScanGit.html
import { useId, useState } from 'react';
import type { Application } from '../../api/session';
import { useWorkspace } from '../../workspace/useWorkspace';
import { Icon } from '../../components/Icon';
import { ErrorState, Loading } from '../../components/ui';
import { useScanDraft } from '../NewScan/draftStore';
import { componentLabel, listNames, repoIdentity, sameComponent, type ComponentRole, type ScanComponent } from '../NewScan/scanDraft';
import { makeComponent, parseRepoLines, pseudoHash } from './componentRules';
import { ManualScanLayout } from './ManualScanLayout';
import styles from './NewScan.module.css';

export default function NewScanGitScreen() {
  // The application chosen in workspace context (sidebar or drill-down), not the session default.
  const { application: app } = useWorkspace();
  return <GitBatch key={app.id} app={app} />;
}

function GitBatch({ app }: { app: Application }) {
  const store = useScanDraft(app.id);
  const [role, setRole] = useState<ComponentRole>('source');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const hintId = useId();
  const errorId = useId();

  if (store.error) return <ErrorState error={store.error} />;
  if (!store.draft) return <Loading />;
  const components = store.draft.components;

  const add = () => {
    const { valid, invalid } = parseRepoLines(text);
    if (invalid.length > 0) {
      // Keep the input so the user can correct it.
      setError(`Not a repository URL: ${invalid.join(', ')}. Use https://host/org/repo, optionally with @branch.`);
      setReceipt(null);
      return;
    }
    // Same repository (canonical host/owner/repo) as anything already in the draft, including
    // discovered ones, or earlier in this batch. Same-named repos from other owners are kept.
    const isIn = (r: { url: string; name: string }) =>
      components.some((c) => sameComponent(c, { _id: '', name: r.name, repoUrl: r.url } as typeof c));
    const key = (r: { url: string }) => repoIdentity(r.url) ?? r.url.toLowerCase();
    const fresh = valid.filter((r, i) => !isIn(r) && valid.findIndex((v) => key(v) === key(r)) === i);
    const skipped = valid.filter((r) => !fresh.includes(r)).map((r) => componentLabel({ name: r.name, repoUrl: r.url } as ScanComponent));
    // TODO(backend): resolve each ref to its commit with the user's PAT; the PAT never reaches the browser.
    const added = fresh.map((r) =>
      makeComponent(
        { name: r.name, origin: 'git', repoUrl: r.url, ref: r.branch ?? 'main', commit: pseudoHash(r.line), note: 'just added' },
        role,
      ),
    );
    store.actions.add(added);
    setText('');
    setError(null);
    const parts: string[] = [];
    if (added.length) {
      parts.push(`Added ${added.length} ${added.length === 1 ? 'component' : 'components'}: ${added.map(componentLabel).join(', ')}. ${added.length === 1 ? 'It is' : 'They are'} in the list below.`);
    }
    if (skipped.length) parts.push(`Already in this scan: ${listNames(skipped)}.`);
    const suggested = added.filter((c) => !c.roleConfirmed);
    if (suggested.length) parts.push(`Check the suggested role for ${listNames(suggested.map(componentLabel))}.`);
    setReceipt(parts.join(' '));
  };

  return (
    <ManualScanLayout
      app={app}
      where="git"
      role={role}
      onRoleChange={setRole}
      store={store}
      details={
        <div className={styles.repoField}>
          <label htmlFor={`${hintId}-urls`}>Repository URLs</label>
          <textarea
            id={`${hintId}-urls`}
            className={styles.repoText}
            rows={3}
            value={text}
            placeholder={'https://github.com/org/repo@branch\nhttps://github.com/org/other-repo'}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
          />
          <span id={hintId} className={styles.hint}>
            One per line. Add @branch to choose a branch, otherwise the default branch is used. Each is pinned to its exact commit when added.
          </span>
          {error && <span id={errorId} className={styles.error} role="alert">{error}</span>}
        </div>
      }
      addRow={
        <div className="row" style={{ gap: 12 }}>
          <button type="button" className="btn dark" disabled={!text.trim()} onClick={add}>
            Add to scan
          </button>
          <span role="status" className={styles.receipt}>
            {receipt && (
              <>
                <Icon name="check" size={16} strokeWidth={2.2} />
                {receipt}
              </>
            )}
          </span>
        </div>
      }
    />
  );
}

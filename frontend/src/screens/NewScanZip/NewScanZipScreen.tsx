import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useApi } from '../../api/useApi';
import type { Application } from '../../api/session';
import { useWorkspace } from '../../workspace/useWorkspace';
import { Icon } from '../../components/Icon';
import { ErrorState, Loading } from '../../components/ui';
import { useScanDraft } from '../NewScan/draftStore';
import { listNames, newId, type ComponentRole } from '../NewScan/scanDraft';
import { makeComponent, pseudoHash } from '../NewScanGit/componentRules';
import { ManualScanLayout } from '../NewScanGit/ManualScanLayout';
import styles from '../NewScanGit/NewScan.module.css';
import { fetchStagedZips, MAX_ZIP_BYTES, type StagedZip } from './api';

/** Simulated malware/secret scan time per file. TODO(backend): poll the scan job instead. */
const SCAN_MS = 4000;

export default function NewScanZipScreen() {
  // The application chosen in workspace context (sidebar or drill-down), not the session default.
  const { application: app } = useWorkspace();
  return <ZipBatch key={app.id} app={app} />;
}

function ZipBatch({ app }: { app: Application }) {
  const stagedApi = useApi(fetchStagedZips);
  const store = useScanDraft(app.id);
  const [role, setRole] = useState<ComponentRole>('automation');
  const [staged, setStaged] = useState<StagedZip[] | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  if (staged === null && stagedApi.data) setStaged(stagedApi.data);

  // Finish each simulated scan after a delay.
  useEffect(() => {
    for (const f of staged ?? []) {
      if (f.state !== 'scanning' || timers.current.has(f.id)) continue;
      timers.current.set(
        f.id,
        setTimeout(() => {
          timers.current.delete(f.id);
          setStaged((list) => list?.map((x) => (x.id === f.id ? { ...x, state: 'ready' } : x)) ?? null);
        }, SCAN_MS),
      );
    }
  }, [staged]);
  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  const error = stagedApi.error ?? store.error;
  if (error) return <ErrorState error={error} />;
  if (!store.draft || !staged) return <Loading />;

  const stage = (files: FileList | File[]) => {
    const next: StagedZip[] = [...files].map((file) => {
      const base = { id: newId('zip'), fileName: file.name, name: file.name.replace(/\.zip$/i, ''), sizeBytes: file.size };
      if (!/\.zip$/i.test(file.name)) return { ...base, state: 'rejected', reason: 'not a ZIP file' };
      if (file.size > MAX_ZIP_BYTES) return { ...base, state: 'rejected', reason: 'over 500 MB' };
      // TODO(backend): upload to POST /api/apps/{appId}/scan-draft/zips; the worker scans it.
      return { ...base, state: 'scanning' };
    });
    setStaged([...staged, ...next]);
    setReceipt(null);
  };

  const removeStaged = (id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setStaged(staged.filter((f) => f.id !== id));
  };

  const ready = staged.filter((f) => f.state === 'ready');
  const scanning = staged.filter((f) => f.state === 'scanning');

  const addReady = () => {
    const added = ready.map((f) =>
      makeComponent(
        { name: f.name, origin: 'zip', zip: { fileName: f.fileName, sha256: `${pseudoHash(f.fileName, 4)}…${pseudoHash(f.id, 4)}` }, note: 'just added' },
        role,
      ),
    );
    store.actions.add(added);
    setStaged(staged.filter((f) => f.state !== 'ready'));
    const suggested = added.filter((c) => !c.roleConfirmed);
    setReceipt(
      `Added ${added.length} ${added.length === 1 ? 'component' : 'components'}: ${added.map((c) => c.name).join(', ')}.` +
        (suggested.length ? ` Check the suggested role for ${listNames(suggested.map((c) => c.name))}.` : ''),
    );
  };

  const statusText =
    receipt ??
    (scanning.length > 0
      ? `${listNames(scanning.map((f) => f.fileName))} ${scanning.length === 1 ? 'is' : 'are'} still being scanned. Add ${scanning.length === 1 ? 'it' : 'them'} when the scan finishes.`
      : ready.length === 0
        ? 'Choose one or more ZIPs to add.'
        : '');

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) stage(e.dataTransfer.files);
  };

  return (
    <ManualScanLayout
      app={app}
      where="zip"
      role={role}
      onRoleChange={setRole}
      store={store}
      details={
        <>
          <label
            className={`${styles.drop} ${dragging ? styles.dropActive : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <Icon name="upload" size={20} />
            <span className={styles.dropTitle}>Drop one or more ZIPs here, or browse</span>
            <span className="small muted">Each ZIP becomes its own component · up to 500 MB each · scanned for malware and secrets</span>
            <input
              type="file"
              accept=".zip"
              multiple
              onChange={(e) => {
                if (e.target.files?.length) stage(e.target.files);
                e.target.value = '';
              }}
            />
          </label>

          <span id="staged-heading" className="eyebrow">Files awaiting addition · {staged.length}</span>
          {staged.length === 0 ? (
            <span className="small muted">No files waiting. Files you choose appear here while they are scanned.</span>
          ) : (
            <ul aria-labelledby="staged-heading" className={styles.staged}>
              {staged.map((f) => (
                <li key={f.id} className={styles.stagedItem}>
                  <span className={styles.stagedName}>{f.fileName}</span>
                  {f.state === 'rejected' ? (
                    <span className={styles.stagedReject}>Can't add: {f.reason}</span>
                  ) : (
                    <span className={styles.stagedState}>
                      Name: {f.name} · {f.state === 'ready' ? 'ready' : 'scanning…'}
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.textBtn}
                    aria-label={`${f.state === 'scanning' ? 'Cancel scan' : 'Remove'} ${f.fileName}`}
                    onClick={() => removeStaged(f.id)}
                  >
                    {f.state === 'scanning' ? 'Cancel scan' : 'Remove'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {role === 'automation' && (
            <div className={styles.patchNote}>
              Automation from a ZIP has no repository to open a pull request against, so Matrix delivers its changes as a patch to download.
            </div>
          )}
        </>
      }
      addRow={
        <div className="row" style={{ gap: 12 }}>
          <button
            type="button"
            className="btn dark"
            disabled={ready.length === 0}
            aria-describedby="zip-add-status"
            onClick={addReady}
          >
            Add {ready.length} ready {ready.length === 1 ? 'ZIP' : 'ZIPs'}
          </button>
          <span id="zip-add-status" role="status" className={receipt ? styles.receipt : styles.pending}>
            {receipt && <Icon name="check" size={16} strokeWidth={2.2} />}
            {statusText}
          </span>
        </div>
      }
    />
  );
}

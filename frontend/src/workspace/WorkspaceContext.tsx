import { useState, type ReactNode } from 'react';
import type { Session } from '../api/session';
import { WorkspaceContext } from './context';

const APP_KEY = 'matrix.application';
const wsKey = (appId: string) => `matrix.workspace.${appId}`;
/** Stored for "All workspaces", so an explicit choice differs from "never chosen". */
const ALL = '*';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Application (sidebar) and workspace (top right) the user works in. Regression works across all
 * workspaces of the application and uses the choice as a filter; Acceptance needs one workspace
 * (docs/SCREENS.md, "Workspace switcher").
 * TODO(backend): store the choice as a user preference and send it with every API call.
 */
export function WorkspaceProvider({ session, children }: { session: Session; children: ReactNode }) {
  const [appId, setAppId] = useState(() => read(APP_KEY) ?? session.application.id);
  const [appChosen, setAppChosen] = useState(() => read(APP_KEY) !== null);
  const application = session.applications.find((a) => a.id === appId) ?? session.application;
  const workspaces = session.workspaces.filter((w) => w.appId === application.id);
  const [stored, setStored] = useState<string | null>(() => read(wsKey(application.id)));
  const current = workspaces.find((w) => w.id === stored) ?? null;

  const choose = (nextApp: string, workspaceId: string | null) => {
    const value = workspaceId ?? ALL;
    setAppId(nextApp);
    setAppChosen(true);
    setStored(value);
    write(APP_KEY, nextApp);
    write(wsKey(nextApp), value);
  };

  const selectApplication = (nextApp: string) => {
    if (!session.applications.some((a) => a.id === nextApp)) return false;
    if (nextApp === application.id) return true;
    setAppId(nextApp);
    setAppChosen(true);
    setStored(read(wsKey(nextApp)));
    write(APP_KEY, nextApp);
    return true;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        applications: session.applications,
        application,
        workspaces,
        current,
        // An application chosen once (sign-in prompt or drill-down) counts; its workspace may be unset (all).
        isSet: appChosen || stored !== null,
        setWorkspace: (id) => choose(application.id, id),
        choose,
        selectApplication,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

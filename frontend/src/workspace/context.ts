import { createContext } from 'react';
import type { Application, Workspace } from '../api/session';

export interface WorkspaceState {
  applications: Application[];
  application: Application;
  /** Workspaces (components) of the current application. */
  workspaces: Workspace[];
  /** The workspace chosen at the top right, or null for "All workspaces". */
  current: Workspace | null;
  /** False until the user has chosen once; the shell then asks after sign-in. */
  isSet: boolean;
  setWorkspace: (id: string | null) => void;
  /** Choose an application and one of its workspaces (null = all of them) in one step. */
  choose: (appId: string, workspaceId: string | null) => void;
  /**
   * Switch application and restore that application's stored workspace preference ("All
   * workspaces" when it has none). Used when navigation carries an application, e.g. `?app=CRDP`.
   * Returns false, changing nothing, when the application is not one the user can open.
   */
  selectApplication: (appId: string) => boolean;
}

export const WorkspaceContext = createContext<WorkspaceState | null>(null);

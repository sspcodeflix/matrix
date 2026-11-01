import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell, type RouteHandle } from './components/AppShell';
import { Loading } from './components/ui';

const screen = (load: () => Promise<{ default: ComponentType }>) => {
  const Component = lazy(load);
  return (
    <Suspense fallback={<Loading />}>
      <Component />
    </Suspense>
  );
};

const route = (path: string, title: string, load: () => Promise<{ default: ComponentType }>) => ({
  path,
  handle: { title } satisfies RouteHandle,
  element: screen(load),
});

export const router = createBrowserRouter([
  { path: '/', element: screen(() => import('./screens/Landing/LandingScreen')) },
  {
    element: <AppShell />,
    children: [
      route('/overview', 'Overview', () => import('./screens/Overview/OverviewScreen')),
      route('/acceptance', 'Acceptance', () => import('./screens/Acceptance/AcceptanceScreen')),
      route('/acceptance/stories/:storyId', 'Acceptance story', () => import('./screens/AcceptanceStory/AcceptanceStoryScreen')),
      route('/regression', 'Regression', () => import('./screens/Regression/RegressionScreen')),
      route('/regression/compare', 'Compare scans', () => import('./screens/Compare/CompareScreen')),
      route('/scans/new', 'New scan', () => import('./screens/NewScan/NewScanScreen')),
      route('/scans/new/git', 'New scan', () => import('./screens/NewScanGit/NewScanGitScreen')),
      route('/scans/new/zip', 'New scan', () => import('./screens/NewScanZip/NewScanZipScreen')),
      route('/processing', 'Processing', () => import('./screens/WorkflowProcessing/WorkflowProcessingScreen')),
      route('/journeys', 'Journeys', () => import('./screens/Journeys/JourneysScreen')),
      route('/review', 'Review queue', () => import('./screens/Review/ReviewScreen')),
      route('/runs', 'Runs', () => import('./screens/Runs/RunsScreen')),
      route('/huddle', 'Huddle', () => import('./screens/Huddle/HuddleScreen')),
      route('/context', 'App context', () => import('./screens/Context/ContextScreen')),
      route('/skills', 'Skills', () => import('./screens/Skills/SkillsScreen')),
      route('/prompt-studio', 'Prompt studio', () => import('./screens/PromptStudio/PromptStudioScreen')),
      route('/stats', 'User stats', () => import('./screens/Stats/StatsScreen')),
      route('/settings', 'Settings', () => import('./screens/Settings/SettingsScreen')),
      route('/settings/test-identities', 'Test identities', () => import('./screens/TestIdentities/TestIdentitiesScreen')),
      route('/settings/test-data', 'Test data', () => import('./screens/TestData/TestDataScreen')),
      { path: '*', element: <Navigate to="/overview" replace /> },
    ],
  },
]);

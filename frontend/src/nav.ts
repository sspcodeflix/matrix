/** Sidebar structure. `key` matches Session.navBadges. */
export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: string;
  adminOnly?: boolean;
  /** Other path prefixes that belong to this item, e.g. scan setup under Regression. */
  alsoActive?: string[];
}

export const navSections: { label?: string; items: NavItem[] }[] = [
  { items: [{ key: 'overview', label: 'Overview', path: '/overview', icon: 'stats' }] },
  {
    label: 'Workflows',
    items: [
      { key: 'acceptance', label: 'Acceptance', path: '/acceptance', icon: 'acceptance' },
      { key: 'regression', label: 'Regression', path: '/regression', icon: 'regression', alsoActive: ['/scans'] },
      { key: 'journeys', label: 'Journeys', path: '/journeys', icon: 'journeys' },
    ],
  },
  {
    label: 'Your work',
    items: [
      { key: 'review', label: 'Review queue', path: '/review', icon: 'review' },
      { key: 'runs', label: 'Runs', path: '/runs', icon: 'runs' },
      { key: 'huddle', label: 'Huddle', path: '/huddle', icon: 'huddle' },
    ],
  },
  {
    label: 'Knowledge OS',
    items: [{ key: 'context', label: 'App context', path: '/context', icon: 'context' }],
  },
  {
    label: 'Admin',
    items: [
      { key: 'skills', label: 'Skills', path: '/skills', icon: 'skills', adminOnly: true },
      { key: 'prompt-studio', label: 'Prompt studio', path: '/prompt-studio', icon: 'prompt' },
      { key: 'stats', label: 'User stats', path: '/stats', icon: 'stats' },
      { key: 'settings', label: 'Settings', path: '/settings', icon: 'settings' },
    ],
  },
];

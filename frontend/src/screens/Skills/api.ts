import { mock } from '../../api/useApi';

export type SkillType = 'Framework' | 'App';
export type SkillStatus = 'live' | 'proposed' | 'draft';

export interface EvalRow {
  check: string;
  /** Live version result, percent. */
  current: number;
  /** Proposed version result, percent; null while the eval is pending. */
  proposed: number | null;
}

/** skill_proposals: { skill, fromVersion, text, evidence: [rejectionIds], status } plus its eval. */
export interface SkillProposal {
  fromVersion: string;
  toVersion: string;
  rejectionCount: number;
  text: string;
  evidence: { label: string; count: number }[];
  /** Overall golden-dataset pass rate of the proposed version, percent. */
  passRate: number;
  evals: EvalRow[];
  diff: { op: 'add' | 'del' | 'same'; text: string }[];
}

export interface Skill {
  name: string;
  type: SkillType;
  version: string;
  commit: string;
  apps: number;
  /** Eval pass rate of the current version on golden datasets, percent. */
  evalPassRate: number;
  status: SkillStatus;
  owner: string;
  description: string;
  source: string;
  proposal?: SkillProposal;
}

export interface SkillsData {
  appName: string;
  /** Promotion gate on golden datasets, percent. */
  gate: number;
  snapshot: string;
  /** When the eval results in `snapshot` were captured (ISO 8601, UTC). */
  snapshotCapturedAt: string;
  /** Stable snapshot ID for export file names and de-duplication. */
  snapshotId: string;
  skills: Skill[];
}

// TODO(backend): GET /api/skills (admin only). Sample names are placeholders from the design kit.
const sample: SkillsData = {
  appName: 'Payments Hub',
  gate: 90,
  snapshot: 'Evals as of today 09:42 · matrix-skills@4f2c9e1',
  snapshotCapturedAt: '2026-11-01T09:42:00Z',
  snapshotId: 'EVAL-4f2c9e1',
  skills: [
    {
      name: 'selenium-java-pageobject', type: 'Framework', version: 'v3', commit: 'a1b2c3d', apps: 4, evalPassRate: 94, status: 'proposed',
      owner: 'Arjun S.', source: 'Git, synced to MLflow',
      description: 'Writes UI automation with page objects, explicit waits and test-data builders.',
      proposal: {
        fromVersion: 'v3', toVersion: 'v4', rejectionCount: 4,
        text: 'Never hard-code retry counts or timeouts; read them from the app config fixture.',
        evidence: [{ label: 'convention not followed', count: 3 }, { label: 'wrong assertion', count: 1 }],
        passRate: 97,
        evals: [
          { check: 'Compiles', current: 100, proposed: 100 },
          { check: 'Green on HyperExecute', current: 94, proposed: 97 },
          { check: 'Assertions trace to an FR', current: 92, proposed: 96 },
          { check: 'Accepted without edits', current: 71, proposed: null },
        ],
        diff: [
          { op: 'same', text: '- Explicit waits only (WebDriverWait); never Thread.sleep.' },
          { op: 'del', text: '- Prefer short timeouts for retry tests.' },
          { op: 'add', text: '- Never hard-code retry counts or timeouts; read them from the app config fixture.' },
          { op: 'same', text: '- Assertions must check the expected result stated in the requirement.' },
        ],
      },
    },
    { name: 'karate-api', type: 'Framework', version: 'v2', commit: '9e8d7c6', apps: 3, evalPassRate: 97, status: 'live', owner: 'Rohan I.', source: 'Git, synced to MLflow', description: 'Writes API tests as Karate features with reusable auth and data setup.' },
    { name: 'hyperexecute-yaml', type: 'Framework', version: 'v1', commit: '5f4e3d2', apps: 4, evalPassRate: 100, status: 'live', owner: 'Deepa V.', source: 'Git, synced to MLflow', description: 'Writes HyperExecute job YAML so Harness can run the generated tests.' },
    { name: 'octane-case-format', type: 'Framework', version: 'v2', commit: '1a2b3c4', apps: 4, evalPassRate: 99, status: 'live', owner: 'Meera K.', source: 'Git, synced to MLflow', description: 'Formats manual test cases for Octane with steps, expected results and requirement links.' },
    { name: 'payments-hub-conventions', type: 'App', version: 'v1', commit: '7c6b5a4', apps: 1, evalPassRate: 91, status: 'live', owner: 'Priya N.', source: 'Git, synced to MLflow', description: 'App conventions: builders for amounts and currencies, config fixture, page-object locations.' },
    { name: 'cards-gateway-conventions', type: 'App', version: 'v0', commit: '3d2c1b0', apps: 1, evalPassRate: 78, status: 'draft', owner: 'Sahil K.', source: 'Git, not yet synced', description: 'App conventions for Cards Gateway. Draft until evals reach the gate.' },
    { name: 'playwright-ts', type: 'Framework', version: 'v1', commit: 'b4c5d6e', apps: 2, evalPassRate: 93, status: 'live', owner: 'Arjun S.', source: 'Git, synced to MLflow', description: 'Writes Playwright TypeScript tests with fixtures and role-based locators.' },
    { name: 'restassured-java', type: 'Framework', version: 'v2', commit: 'e6f7a8b', apps: 2, evalPassRate: 95, status: 'live', owner: 'Rohan I.', source: 'Git, synced to MLflow', description: 'Writes REST Assured API tests with request specs and schema checks.' },
    { name: 'gherkin-acceptance', type: 'Framework', version: 'v1', commit: 'c9d0e1f', apps: 3, evalPassRate: 92, status: 'live', owner: 'Meera K.', source: 'Git, synced to MLflow', description: 'Writes acceptance test cases as Given/When/Then scenarios from Jira stories.' },
  ],
};

export const fetchSkills = () => mock(sample);

import { mock } from '../../api/useApi';
import type { ScanComponent, ScanDraft } from './scanDraft';

export type { ScanComponent, ScanDraft } from './scanDraft';

export interface DiscoveryResult {
  appId: string;
  appName: string;
  /** Repository tag names the discovery matched on. */
  customProperty: string;
  topic: string;
  components: ScanComponent[];
}

// TODO(backend): POST /api/apps/{appId}/discovery (GitSaaS search with the user's PAT via the credential broker)
// plus GET /api/apps/{appId}/components for manually added ones. Sample names are placeholders.
const sample: DiscoveryResult = {
  appId: 'PAYH',
  appName: 'Payments Hub',
  customProperty: 'app_id',
  topic: 'app-payments-hub',
  components: [
    {
      _id: 'c-merchant-portal', name: 'merchant-portal', role: 'source', type: 'web', frameworks: [], origin: 'discovered',
      repoUrl: 'https://github.com/payments/merchant-portal', roleConfirmed: true,
      discovery: { method: 'custom_property', value: 'app_id', confirmed: true }, ref: 'main', commit: '4f2a1c9',
    },
    {
      _id: 'c-ops-console', name: 'ops-console', role: 'source', type: 'web', frameworks: [], origin: 'discovered',
      repoUrl: 'https://github.com/payments/ops-console', roleConfirmed: true,
      discovery: { method: 'topic', value: 'app-payments-hub', confirmed: true }, ref: 'main', commit: '77be03d',
    },
    {
      _id: 'c-pay-hub-automation', name: 'pay-hub-automation', role: 'automation', type: 'automation',
      frameworks: ['Selenium', 'Karate'], origin: 'discovered', repoUrl: 'https://github.com/payments/pay-hub-automation',
      roleConfirmed: true, discovery: { method: 'custom_property', value: 'app_id', confirmed: true }, ref: 'main', commit: 'a1b2c3d',
    },
    {
      _id: 'c-refunds-api', name: 'refunds-api', role: 'source', type: 'api', frameworks: [], origin: 'git',
      repoUrl: 'https://github.com/payments/refunds-api', roleConfirmed: true, note: 'added manually',
      ref: 'release/26.11', commit: '9c41e2a',
    },
    {
      _id: 'c-payments-common-lib', name: 'payments-common-lib', role: 'source', type: 'library', frameworks: [], origin: 'discovered',
      repoUrl: 'https://github.com/payments/payments-common-lib', roleConfirmed: true,
      discovery: { method: 'name', confirmed: false }, ref: 'main', commit: '0d7e5aa',
    },
  ],
};

/** Only the sample application has discovered repositories; any other finds none yet. */
export const fetchDiscovery = (appId: string, appName: string) =>
  mock<DiscoveryResult>(
    appId === sample.appId
      ? sample
      : { appId, appName, customProperty: 'app_id', topic: `app-${appId.toLowerCase()}`, components: [] },
  );

// ---- Scan draft persistence --------------------------------------------------------------
// The draft is also cached in sessionStorage so a refresh restores it before the backend answers.

// TODO(backend): GET /api/apps/{appId}/scan-draft -> the saved draft, or 404 when there is none.
// The mock has no saved draft, so the first visit starts a new one (seeded by discovery).
export const loadScanDraft = (appId: string) => {
  void appId;
  return mock<ScanDraft | null>(null);
};

// TODO(backend): PUT /api/apps/{appId}/scan-draft { draft } (last write wins; add a version check
// if two tabs can edit the same application's draft).
export const saveScanDraft = (draft: ScanDraft) => mock({ appId: draft.appId, savedAt: new Date().toISOString() });

// TODO(backend): DELETE /api/apps/{appId}/scan-draft.
export const discardScanDraft = (appId: string) => mock({ appId, discarded: true });

// ---- Actions -----------------------------------------------------------------------------

// TODO(backend): POST /api/components/{id}/confirm.
export const confirmComponent = (id: string) => mock({ id, confirmed: true });

// TODO(backend): PUT /api/apps/{appId}/default-components { componentIds }.
export const saveDefaultComponents = (appId: string, componentIds: string[]) => {
  void appId;
  return mock({ saved: componentIds.length });
};

// TODO(backend): POST /api/apps/{appId}/scans { mode, components (pinned ref/commit or ZIP hash) } -> scan id + workflow job.
export const startScan = (appId: string, components: ScanComponent[]) => {
  void appId;
  return mock({ scanId: 'S-023', components: components.length }, 400);
};

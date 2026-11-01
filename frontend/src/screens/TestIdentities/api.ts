import { mock } from '../../api/useApi';

export type IdentityStatus = 'signed_in' | 'expiring' | 'failed' | 'not_checked';

/** docs/DATA_MODEL.md test_identities. `secretRef` is a vault reference; secret values never reach the UI. */
export interface TestIdentity {
  _id: string;
  appId: string;
  role: string;
  env: string;
  secretRef: string;
  expectedEntitlements: string;
  /** Last successful sign-in check (ISO, UTC). */
  lastLogin: string | null;
  status: IdentityStatus;
  /** Human detail for expiring/failed states, e.g. "MFA prompt" or "Password expires in 4 days". */
  statusDetail?: string;
}

export interface TestIdentitiesData {
  identities: TestIdentity[];
  environments: string[];
  /** When the readiness data was last captured, for the report snapshot. */
  dataAsOf: string;
  /** Entitlement source; null until connected (placeholder from the design kit). */
  entitlementSource: string | null;
}

// TODO(backend): GET /api/apps/{appId}/test-identities. Sample values are placeholders.
const sample: TestIdentitiesData = {
  dataAsOf: '2026-11-01T06:01:00Z',
  environments: ['SIT-2', 'UAT'],
  entitlementSource: null,
  identities: [
    { _id: 'ti-01', appId: 'app-payments-hub', role: 'Ops maker', env: 'SIT-2', secretRef: 'vault://matrix/pay/sit2/ops-maker', expectedEntitlements: 'Submit refunds, run settlement', lastLogin: '2026-11-01T06:00:00Z', status: 'signed_in' },
    { _id: 'ti-02', appId: 'app-payments-hub', role: 'Ops checker', env: 'SIT-2', secretRef: 'vault://matrix/pay/sit2/ops-checker', expectedEntitlements: 'Approve refunds and settlements', lastLogin: '2026-11-01T06:00:00Z', status: 'signed_in' },
    { _id: 'ti-03', appId: 'app-payments-hub', role: 'Auditor (read-only)', env: 'SIT-2', secretRef: 'vault://matrix/pay/sit2/auditor', expectedEntitlements: 'View all, no actions', lastLogin: '2026-11-01T06:01:00Z', status: 'signed_in' },
    { _id: 'ti-04', appId: 'app-payments-hub', role: 'Support L1', env: 'SIT-2', secretRef: 'vault://matrix/pay/sit2/support-l1', expectedEntitlements: 'Merchant lookup, webhook re-send', lastLogin: '2026-11-01T06:01:00Z', status: 'signed_in' },
    { _id: 'ti-05', appId: 'app-payments-hub', role: 'Ops maker', env: 'UAT', secretRef: 'vault://matrix/pay/uat/ops-maker', expectedEntitlements: 'Submit refunds, run settlement', lastLogin: null, status: 'failed', statusDetail: 'MFA prompt' },
    { _id: 'ti-06', appId: 'app-payments-hub', role: 'Ops checker', env: 'UAT', secretRef: 'vault://matrix/pay/uat/ops-checker', expectedEntitlements: 'Approve refunds and settlements', lastLogin: '2026-11-01T06:02:00Z', status: 'expiring', statusDetail: 'Password expires in 4 days' },
    { _id: 'ti-07', appId: 'app-payments-hub', role: 'Auditor (read-only)', env: 'UAT', secretRef: 'vault://matrix/pay/uat/auditor', expectedEntitlements: 'View all, no actions', lastLogin: '2026-11-01T06:02:00Z', status: 'signed_in' },
    { _id: 'ti-08', appId: 'app-payments-hub', role: 'Support L1', env: 'UAT', secretRef: 'vault://matrix/pay/uat/support-l1', expectedEntitlements: 'Merchant lookup, webhook re-send', lastLogin: '2026-11-01T06:03:00Z', status: 'signed_in' },
  ],
};

export const fetchTestIdentities = () => mock(sample);

import { mock } from '../../api/useApi';

export type DataSource = 'provisioning_api' | 'synthetic' | 'masked_copy' | 'fixture' | 'none';
export type DataStatus = 'healthy' | 'low' | 'missing';

/** docs/DATA_MODEL.md test_data_needs, per environment. Raw records are never sent to the UI. */
export interface TestDataNeed {
  _id: string;
  appId: string;
  env: string;
  description: string;
  source: DataSource;
  available: number;
  /** Records reserved right now, or "shared" for static fixtures. */
  reserved: number | 'shared';
  status: DataStatus;
}

export interface Reservation {
  runId: string;
  label: string;
  records: number;
}

export interface BlockingNeed {
  needId: string;
  blockedTests: number;
  runId: string;
}

export interface TestDataData {
  needs: TestDataNeed[];
  environments: string[];
  defaultEnv: string;
  reservations: Reservation[];
  blocking: BlockingNeed[];
  dataAsOf: string;
  /** Example test header showing @role / @data, in the app's automation language. */
  example: string;
}

const APP = 'app-payments-hub';
type Tuple = [string, string, DataSource, number, number | 'shared', DataStatus];

// [id, description, source, available, reserved, status]
const sit2: Tuple[] = [
  ['card-payment.settled.aed.gt500', 'Settled card payment, AED, over 500', 'provisioning_api', 142, 12, 'healthy'],
  ['refund.pending-checker', 'Refund awaiting checker approval', 'synthetic', 38, 4, 'healthy'],
  ['merchant.multi-currency', 'Merchant with AED, USD and GBP accounts', 'masked_copy', 6, 3, 'low'],
  ['chargeback.gbp', 'Chargeback on a GBP payment', 'none', 0, 0, 'missing'],
  ['calendar.holidays.2026', 'Settlement holiday calendar 2026', 'fixture', 1, 'shared', 'healthy'],
  ['card.expired', 'Expired test card', 'synthetic', 20, 0, 'healthy'],
  ['card-payment.pending.usd', 'Pending card payment, USD', 'provisioning_api', 64, 2, 'healthy'],
  ['card-payment.declined', 'Declined card payment with issuer reason code', 'synthetic', 45, 1, 'healthy'],
  ['refund.partial.aed', 'Partially refunded AED payment', 'synthetic', 31, 0, 'healthy'],
  ['refund.rejected-checker', 'Refund rejected by checker', 'synthetic', 18, 0, 'healthy'],
  ['merchant.suspended', 'Suspended merchant account', 'masked_copy', 4, 0, 'low'],
  ['merchant.new-onboarding', 'Merchant in onboarding, KYC pending', 'masked_copy', 9, 1, 'low'],
  ['settlement.batch.open', 'Open settlement batch', 'provisioning_api', 12, 2, 'healthy'],
  ['settlement.batch.failed', 'Settlement batch failed at GL posting', 'synthetic', 7, 0, 'low'],
  ['gl.settlement-file.sample', 'GL settlement file sample', 'fixture', 1, 'shared', 'healthy'],
  ['webhook.undelivered', 'Webhook with three failed deliveries', 'synthetic', 25, 0, 'healthy'],
  ['acquirer.timeout', 'Acquirer timeout on authorisation', 'synthetic', 15, 2, 'healthy'],
  ['acquirer.retry-exhausted', 'Acquirer retries exhausted', 'synthetic', 11, 0, 'healthy'],
  ['fx.rate-card.daily', 'Daily FX rate card', 'fixture', 1, 'shared', 'healthy'],
  ['fee.rounding.edge', 'Fee rounding edge-case amounts', 'synthetic', 40, 0, 'healthy'],
  ['card.3ds-challenge', 'Card requiring a 3-D Secure challenge', 'provisioning_api', 22, 3, 'healthy'],
  ['card.blocked', 'Blocked test card', 'synthetic', 14, 0, 'healthy'],
  ['payout.scheduled', 'Scheduled merchant payout', 'provisioning_api', 28, 1, 'healthy'],
  ['payout.on-hold', 'Payout on compliance hold', 'masked_copy', 3, 0, 'low'],
  ['dispute.evidence-due', 'Dispute with evidence due in 2 days', 'none', 0, 0, 'missing'],
  ['user.locked', 'Locked portal user', 'synthetic', 10, 0, 'healthy'],
  ['report.monthly-statement', 'Monthly merchant statement', 'fixture', 1, 'shared', 'healthy'],
];

const uat: Tuple[] = [
  ['card-payment.settled.aed.gt500', 'Settled card payment, AED, over 500', 'masked_copy', 48, 6, 'healthy'],
  ['refund.pending-checker', 'Refund awaiting checker approval', 'synthetic', 12, 2, 'healthy'],
  ['merchant.multi-currency', 'Merchant with AED, USD and GBP accounts', 'masked_copy', 2, 1, 'low'],
  ['chargeback.gbp', 'Chargeback on a GBP payment', 'none', 0, 0, 'missing'],
  ['calendar.holidays.2026', 'Settlement holiday calendar 2026', 'fixture', 1, 'shared', 'healthy'],
];

const toNeed = (env: string) => ([_id, description, source, available, reserved, status]: Tuple): TestDataNeed => ({
  _id, appId: APP, env, description, source, available, reserved, status,
});

// TODO(backend): GET /api/apps/{appId}/test-data (needs, reservations, blocking). Sample values are placeholders.
const sample: TestDataData = {
  environments: ['SIT-2', 'UAT'],
  defaultEnv: 'SIT-2',
  needs: [...sit2.map(toNeed('SIT-2')), ...uat.map(toNeed('UAT'))],
  reservations: [
    { runId: '4831', label: 'Run #4831 · nightly regression', records: 16 },
    { runId: 'pr-212', label: 'PR #212 dry run', records: 3 },
  ],
  blocking: [{ needId: 'chargeback.gbp', blockedTests: 2, runId: '4821' }],
  dataAsOf: '2026-11-01T09:40:00Z',
  example: '@role("ops-maker")\n@data("card-payment.settled.aed.gt500")\nvoid partialRefund(Payment p) { … }',
};

export const fetchTestData = () => mock(sample);

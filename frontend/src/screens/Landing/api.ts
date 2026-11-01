import { mock } from '../../api/useApi';

export type PreviewStatus = 'no_test' | 'not_automated' | 'covered';

export interface LandingPreview {
  application: string;
  release: string;
  syncLabel: string;
  kpis: { requirements: number; covered: number; noTest: number; notAutomated: number };
  rows: { id: string; title: string; octaneCases: number; status: PreviewStatus }[];
}

// TODO(backend): GET /api/landing/preview (or a static illustration). Sample values are placeholders.
const sample: LandingPreview = {
  application: 'Payments Hub',
  release: 'Release 26.11',
  syncLabel: 'Knowledge OS synced',
  kpis: { requirements: 38, covered: 27, noTest: 7, notAutomated: 4 },
  rows: [
    { id: 'FR-0214', title: 'Partial refund', octaneCases: 0, status: 'no_test' },
    { id: 'FR-0218', title: 'Acquirer retry', octaneCases: 2, status: 'not_automated' },
    { id: 'FR-0221', title: 'GL settlement file', octaneCases: 4, status: 'covered' },
  ],
};

export const fetchLandingPreview = () => mock(sample);

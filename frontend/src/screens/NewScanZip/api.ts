import { mock } from '../../api/useApi';

export type StagedState = 'scanning' | 'ready' | 'rejected';

/** A ZIP selected for the current batch, before it is added to the scan as a component. */
export interface StagedZip {
  id: string;
  fileName: string;
  /** Component name Matrix proposes, from the ZIP's build files. */
  name: string;
  sizeBytes: number;
  state: StagedState;
  /** Why a rejected file cannot be added. */
  reason?: string;
}

/** Upload limit per ZIP (docs/SCREENS.md, NewScanZip). */
export const MAX_ZIP_BYTES = 500 * 1024 * 1024;

// TODO(backend): GET /api/apps/{appId}/scan-draft/staged-zips. Files are stored on the NAS and
// scanned for malware and secrets by a worker. Sample names are placeholders.
const sample: StagedZip[] = [
  { id: 'zip-1', fileName: 'legacy-tests.zip', name: 'legacy-batch-tests', sizeBytes: 18_400_000, state: 'ready' },
  { id: 'zip-2', fileName: 'api-contract-tests.zip', name: 'api-contract-tests', sizeBytes: 6_200_000, state: 'scanning' },
];

export const fetchStagedZips = () => mock(sample);

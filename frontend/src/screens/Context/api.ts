import { mock } from '../../api/useApi';
import { fetchSession } from '../../api/session';

export type SourceType = 'knowledge_os' | 'confluence' | 'documind' | 'api_spec' | 'pdf' | 'word' | 'journeys';
export type SourceStatus = 'embedded' | 'syncing' | 'failed' | 'stale';

/** Mirror of the `sources` collection with display fields. */
export interface Source {
  _id: string;
  type: SourceType;
  name: string;
  /** Secondary identifier, e.g. "openapi.yaml · v2.4". */
  locator: string;
  /** Component ids; empty means the whole app. */
  componentIds: string[];
  version?: string;
  content: string;
  status: SourceStatus;
  /** Status detail, e.g. "Failed: broken $ref" or "Older than 12 months". */
  statusDetail?: string;
  updatedAt: string;
  updatedLabel: string;
  action: 'resync' | 'update_spec' | 'fix' | 'replace' | 'view';
}

export interface AttentionItem {
  id: string;
  kind: 'conflict' | 'failed_source' | 'stale_source';
  title: string;
  body: string;
  action: { label: string; to?: string; href?: string };
}

export interface RetrievalChunk {
  id: string;
  text: string;
  citation: string;
  score: number;
  /** Chunks sharing a conflict group disagree with each other. */
  conflictGroup?: string;
}

export interface Component {
  id: string;
  kind: string;
}

export interface ContextData {
  application: string;
  /** `refreshedAt`: when the context index was last refreshed (ISO 8601, UTC); the capture time for exports. */
  summary: { chunks: number; store: string; refreshedLabel: string; refreshedAt: string };
  attention: AttentionItem[];
  sources: Source[];
  components: Component[];
  retrieval: { sampleQuery: string; chunks: RetrievalChunk[] };
}

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  knowledge_os: 'Knowledge OS',
  confluence: 'Confluence',
  documind: 'DocuMind',
  api_spec: 'API spec',
  pdf: 'PDF',
  word: 'Word',
  journeys: 'Journeys',
};

// TODO(backend): GET /api/apps/{appId}/context (sources, issues, components).
// Sample names and numbers are placeholders from the design kit.
const sample: Omit<ContextData, 'application'> = {
  summary: { chunks: 3508, store: 'MongoDB', refreshedLabel: 'today 09:42', refreshedAt: '2026-11-01T09:42:00Z' },
  attention: [
    {
      id: 'att-1', kind: 'conflict', title: 'Sources disagree on retry timeout',
      body: 'Confluence says the acquirer timeout is 8 seconds. The refunds-api spec says 10 seconds. Matrix will not use either until someone decides.',
      action: { label: 'Resolve in Huddle', to: '/huddle' },
    },
    {
      id: 'att-2', kind: 'failed_source', title: 'settlement-api spec could not be read',
      body: 'A broken $ref in spec.yaml stopped parsing. Its 9 endpoints are missing from the app context.',
      action: { label: 'Fix the spec', href: '#' },
    },
    {
      id: 'att-3', kind: 'stale_source', title: 'Merchant Ops Manual is from 2024',
      body: 'Older sources rank lower in retrieval. Replace it, or confirm it is still correct.',
      action: { label: 'Replace or confirm', href: '#' },
    },
  ],
  sources: [
    { _id: 's1', type: 'knowledge_os', name: 'Knowledge OS', locator: 'payments-hub', componentIds: [], content: '412 items · 1,820 chunks', status: 'embedded', updatedAt: '2026-11-01T09:42', updatedLabel: '09:42', action: 'resync' },
    { _id: 's2', type: 'confluence', name: 'Confluence · PAY', locator: 'space PAY', componentIds: [], content: '61 pages · 640 chunks', status: 'embedded', updatedAt: '2026-11-01T09:42', updatedLabel: '09:42', action: 'resync' },
    { _id: 's3', type: 'documind', name: 'DocuMind', locator: 'payments-hub docs', componentIds: [], content: '38 docs · 410 chunks', status: 'embedded', updatedAt: '2026-11-01T09:40', updatedLabel: '09:40', action: 'resync' },
    { _id: 's4', type: 'api_spec', name: 'refunds-api', locator: 'openapi.yaml · v2.4', version: 'v2.4', componentIds: ['refunds-api'], content: '24 endpoints · 96 chunks', status: 'embedded', updatedAt: '2026-10-31T12:00', updatedLabel: 'Yesterday', action: 'update_spec' },
    { _id: 's5', type: 'api_spec', name: 'settlement-api', locator: 'spec.yaml · v1.1', version: 'v1.1', componentIds: ['settlement-api'], content: 'Could not parse', status: 'failed', statusDetail: 'Failed: broken $ref', updatedAt: '2026-10-28T10:00', updatedLabel: '28 Oct', action: 'fix' },
    { _id: 's6', type: 'pdf', name: 'Merchant Ops Manual', locator: 'manual-v3.pdf · 2024', componentIds: ['merchant-portal'], content: '84 pages · 312 chunks', status: 'stale', statusDetail: 'Older than 12 months', updatedAt: '2024-03-01T00:00', updatedLabel: 'Mar 2024', action: 'replace' },
    { _id: 's7', type: 'journeys', name: 'Journey crawl', locator: 'SIT-2 · auto-sync after each crawl', componentIds: ['merchant-portal', 'ops-console'], content: '23 journeys · 230 chunks', status: 'embedded', updatedAt: '2026-11-01T06:00', updatedLabel: '06:00', action: 'view' },
  ],
  components: [
    { id: 'merchant-portal', kind: 'Web UI' },
    { id: 'ops-console', kind: 'Web UI' },
    { id: 'refunds-api', kind: 'API · spec' },
    { id: 'settlement-api', kind: 'API · spec failed' },
  ],
  retrieval: {
    sampleQuery: 'What happens when the acquirer times out?',
    chunks: [
      { id: 'c1', text: 'Retry the authorisation up to 3 times, then decline with reason TIMEOUT and notify the merchant.', citation: 'Knowledge OS · FR-0218', score: 0.91 },
      { id: 'c2', text: 'POST /authorisations returns 504 after the acquirer timeout of 10 s.', citation: 'refunds-api spec · v2.4', score: 0.87, conflictGroup: 'acquirer-timeout' },
      { id: 'c3', text: 'Acquirer timeout is 8 seconds for card-present and e-commerce.', citation: 'Confluence · PAY / Retries', score: 0.82, conflictGroup: 'acquirer-timeout' },
      { id: 'c4', text: 'A partial refund cannot exceed the captured amount less previous refunds.', citation: 'Knowledge OS · FR-0214', score: 0.79 },
      { id: 'c5', text: 'Refunds above the daily limit need checker approval before settlement.', citation: 'Merchant Ops Manual · p. 41 · 2024', score: 0.74 },
      { id: 'c6', text: 'The GL settlement file is generated at the 23:00 cut-off each business day.', citation: 'Confluence · PAY / Settlement', score: 0.72 },
    ],
  },
};

export const fetchContext = async (): Promise<ContextData> => {
  const [session, data] = await Promise.all([fetchSession(), mock(sample)]);
  return { ...data, application: session.application.name };
};

const STOP = new Set(['what', 'when', 'the', 'a', 'an', 'is', 'of', 'to', 'does', 'how', 'happens', 'and', 'for', 'in', 'on']);

/**
 * Local mock of test retrieval: keyword overlap over sample chunks, ranked by score.
 * TODO(backend): POST /api/apps/{appId}/context/retrieve (Tachyon embeddings + vector search).
 */
export const testRetrieval = (chunks: RetrievalChunk[], query: string): Promise<RetrievalChunk[]> => {
  const words = query.toLowerCase().split(/[^a-z0-9-]+/).filter((w) => w.length > 2 && !STOP.has(w));
  const stem = (w: string) => w.replace(/(s|es|ed|ing)$/, '');
  const matches = (c: RetrievalChunk) => {
    const text = `${c.text} ${c.citation}`.toLowerCase();
    return words.filter((w) => text.includes(stem(w))).length;
  };
  const hits = chunks
    .map((c) => ({ c, m: matches(c) }))
    .filter((x) => x.m > 0)
    .sort((a, b) => b.c.score - a.c.score)
    .slice(0, 3)
    .map((x) => x.c);
  return mock(hits, 250);
};

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { DownloadRequest } from './types';
import { DownloadReportDialog } from './DownloadReportDialog';

interface DownloadReportApi {
  open: (request: DownloadRequest) => void;
}

const Ctx = createContext<DownloadReportApi | null>(null);

/** One shared Download report dialog for every screen (docs/REPORTS.md). */
export function DownloadReportProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DownloadRequest | null>(null);
  return (
    <Ctx.Provider value={{ open: setRequest }}>
      {children}
      <DownloadReportDialog request={request} onClose={() => setRequest(null)} />
    </Ctx.Provider>
  );
}

export function useDownloadReport() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDownloadReport must be used inside DownloadReportProvider');
  return ctx;
}

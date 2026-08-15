import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import type { ScanResult } from '../data/types';
import { runScan } from './scan';

export interface ScanState {
  status: 'scanning' | 'done';
  result: ScanResult | null;
  rescan: () => void;
}

export const ScanContext = createContext<ScanState | null>(null);

export function useScan(): ScanState {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error('useScan must be used within a ScanContext.Provider');
  return ctx;
}

/** Owns the actual scan lifecycle; App provides the result via ScanContext. */
export function useScanState(): ScanState {
  const [status, setStatus] = useState<'scanning' | 'done'>('scanning');
  const [result, setResult] = useState<ScanResult | null>(null);

  const rescan = useCallback(() => {
    setStatus('scanning');
    runScan().then((next) => {
      setResult(next);
      setStatus('done');
    });
  }, []);

  // Runs once on mount; rescan() is exposed separately for later manual re-scans.
  useEffect(() => {
    rescan();
  }, []);

  return { status, result, rescan };
}

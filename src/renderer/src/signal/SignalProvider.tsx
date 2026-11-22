import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { VitalsSample } from '@shared/types';

import {
  SmartSpectraClient,
  type SignalError,
  type SignalStats,
  type SignalStatus,
} from '../services/smartSpectraClient';

export type SampleListener = (sample: VitalsSample) => void;

export interface SignalContextValue {
  readonly status: SignalStatus;
  readonly stream: MediaStream | null;
  readonly validationOk: boolean;
  readonly validationHint: string;
  readonly error: SignalError | null;
  /** Throughput + last-reading diagnostics, ~1 Hz. Null until running. */
  readonly stats: SignalStats | null;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
  /** Subscribe to raw samples; returns an unsubscribe function. */
  readonly subscribe: (listener: SampleListener) => () => void;
}

const SignalContext = createContext<SignalContextValue | null>(null);

interface SignalProviderProps {
  readonly apiKey: string | null;
  readonly children: ReactNode;
}

/**
 * Owns the single SmartSpectra client for the app and fans its samples out
 * to whichever screen is listening. Samples are delivered through
 * subscriptions rather than React state so a 30 Hz stream doesn't re-render
 * the whole tree.
 */
export function SignalProvider({ apiKey, children }: SignalProviderProps): ReactNode {
  const [status, setStatus] = useState<SignalStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [validationOk, setValidationOk] = useState(false);
  const [validationHint, setValidationHint] = useState('');
  const [error, setError] = useState<SignalError | null>(null);
  const [stats, setStats] = useState<SignalStats | null>(null);

  const listeners = useRef(new Set<SampleListener>());
  const client = useRef<SmartSpectraClient | null>(null);

  useEffect(() => {
    if (apiKey === null) {
      client.current = null;
      return;
    }
    const instance = new SmartSpectraClient(apiKey, {
      onSample: (sample) => {
        for (const listener of listeners.current) {
          listener(sample);
        }
      },
      onStream: setStream,
      onValidation: (ok, hint) => {
        setValidationOk(ok);
        setValidationHint(hint);
      },
      onStatus: (next) => {
        setStatus(next);
        if (next !== 'running') {
          setStream(null);
          setValidationOk(false);
          setStats(null);
        }
        if (next === 'running' || next === 'starting') {
          setError(null);
        }
      },
      onError: setError,
      onStats: setStats,
    });
    client.current = instance;
    return () => {
      void instance.stop();
      client.current = null;
    };
  }, [apiKey]);

  const start = useCallback(async () => {
    const instance = client.current;
    if (!instance) {
      throw new Error('SmartSpectra API key is not configured');
    }
    await instance.start();
  }, []);

  const stop = useCallback(async () => {
    await client.current?.stop();
  }, []);

  const subscribe = useCallback((listener: SampleListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<SignalContextValue>(
    () => ({ status, stream, validationOk, validationHint, error, stats, start, stop, subscribe }),
    [status, stream, validationOk, validationHint, error, stats, start, stop, subscribe],
  );

  return <SignalContext.Provider value={value}>{children}</SignalContext.Provider>;
}

export function useSignal(): SignalContextValue {
  const value = useContext(SignalContext);
  if (!value) {
    throw new Error('useSignal must be used within SignalProvider');
  }
  return value;
}

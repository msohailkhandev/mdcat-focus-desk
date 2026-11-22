import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { AppConfig, Baseline, Question, SessionRecord } from '@shared/types';

import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { loadQuestionBank, shuffle } from './data/questionBank';
import { CalibrationScreen } from './screens/CalibrationScreen';
import { ConsentScreen } from './screens/ConsentScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ReportScreen } from './screens/ReportScreen';
import { TestScreen } from './screens/TestScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { SignalProvider } from './signal/SignalProvider';

/** Questions per practice session. Short on purpose: this is a focus drill, not a full mock. */
const QUESTIONS_PER_SESSION = 12;

type Screen =
  | { readonly name: 'welcome' }
  | { readonly name: 'consent' }
  | { readonly name: 'calibration' }
  | { readonly name: 'test'; readonly baseline: Baseline | null; readonly questions: Question[] }
  | { readonly name: 'report'; readonly session: SessionRecord }
  | { readonly name: 'history' };

export function App(): ReactNode {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'welcome' });
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const bank = useMemo(() => loadQuestionBank(), []);

  const refreshHistory = useCallback(async () => {
    setHistory(await window.api.listSessions());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      const [loadedConfig] = await Promise.all([window.api.getConfig(), refreshHistory()]);
      if (!cancelled) {
        setConfig(loadedConfig);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshHistory]);

  const startTest = useCallback(
    (baseline: Baseline | null) => {
      setScreen({
        name: 'test',
        baseline,
        questions: shuffle(bank).slice(0, QUESTIONS_PER_SESSION),
      });
    },
    [bank],
  );

  const finishTest = useCallback(
    (session: SessionRecord) => {
      setScreen({ name: 'report', session });
      void window.api.saveSession(session).then(refreshHistory);
    },
    [refreshHistory],
  );

  if (!config) {
    return <main className="screen screen--center muted">Loading…</main>;
  }

  return (
    <SignalProvider apiKey={config.smartSpectraApiKey}>
      <DiagnosticsPanel />
      {screen.name === 'welcome' && (
        <WelcomeScreen
          apiKeyConfigured={config.smartSpectraApiKey !== null}
          questionCount={bank.length}
          historyCount={history.length}
          onStartWithCamera={() => {
            setScreen({ name: 'consent' });
          }}
          onStartWithoutCamera={() => {
            startTest(null);
          }}
          onViewHistory={() => {
            setScreen({ name: 'history' });
          }}
        />
      )}

      {screen.name === 'consent' && (
        <ConsentScreen
          onAccept={() => {
            setScreen({ name: 'calibration' });
          }}
          onDecline={() => {
            startTest(null);
          }}
        />
      )}

      {screen.name === 'calibration' && (
        <CalibrationScreen
          onReady={startTest}
          onSkipCamera={() => {
            startTest(null);
          }}
        />
      )}

      {screen.name === 'test' && (
        <TestScreen questions={screen.questions} baseline={screen.baseline} onFinish={finishTest} />
      )}

      {screen.name === 'report' && (
        <ReportScreen
          session={screen.session}
          onHome={() => {
            setScreen({ name: 'welcome' });
          }}
        />
      )}

      {screen.name === 'history' && (
        <HistoryScreen
          sessions={history}
          onOpen={(session) => {
            setScreen({ name: 'report', session });
          }}
          onDeleteAll={async () => {
            await window.api.deleteAllSessions();
            await refreshHistory();
          }}
          onHome={() => {
            setScreen({ name: 'welcome' });
          }}
        />
      )}
    </SignalProvider>
  );
}

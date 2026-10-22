import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getRecordingStore } from './database';
import { discardRecording, finishRecorder, pauseRecorder, reconcileRecorder, startRecorder } from './controller';
import type { RecordingSnapshot } from './store';

export function useRecorder() {
  const [snapshot, setSnapshot] = useState<RecordingSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(false);
  const operating = useRef(false);
  const refreshing = useRef(false);
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const saved = await (await getRecordingStore()).latest();
      if (mounted.current) { setSnapshot(saved); setNow(Date.now()); }
    } finally { refreshing.current = false; }
  }, []);
  const run = useCallback(async (operation: () => Promise<void>) => {
    if (operating.current) return;
    operating.current = true;
    setBusy(true);
    setError(null);
    try { await operation(); }
    catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Something went wrong. Your saved points are kept.');
    } finally {
      try { await refresh(); }
      catch { if (mounted.current) setError('Could not read saved walks. Check device storage and reopen Walquest.'); }
      operating.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [refresh]);
  useEffect(() => {
    mounted.current = true;
    void run(reconcileRecorder);
    const interval = setInterval(() => {
      if (AppState.currentState === 'active' && !operating.current) void refresh().catch(() => {
        if (mounted.current) setError('Could not read saved points. Check device storage.');
      });
    }, 3_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void run(reconcileRecorder);
    });
    return () => { mounted.current = false; clearInterval(interval); subscription.remove(); };
  }, [refresh, run]);
  return {
    snapshot, error, busy, now,
    start: () => run(() => startRecorder(false)), resume: () => run(() => startRecorder(true)),
    pause: () => run(pauseRecorder), finish: () => run(finishRecorder), discard: () => run(discardRecording),
  };
}

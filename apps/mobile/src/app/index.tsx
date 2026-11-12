import { Alert, Linking, Share } from 'react-native';
import { formatDistanceM } from '@walquest/domain/format';
import { WalkMap } from '../components/walk-map';
import { WalkScreen } from '../components/walk-screen';
import { AccountPanel } from '../components/account-panel';
import { summarizeRecording } from '../recording/summary';
import { useRecorder } from '../recording/use-recorder';
import { MAX_SAMPLE_GAP_MS } from '../recording/store';

export default function HomeScreen() {
  const recorder = useRecorder();
  const walk = recorder.snapshot?.walk;
  const summary = summarizeRecording(walk);
  const secondsSinceFix = summary.last ? Math.max(0, Math.round((recorder.now - summary.last.timestampMs) / 1000)) : null;
  const stale = walk?.status === 'recording' && (secondsSinceFix !== null ? secondsSinceFix * 1000 > MAX_SAMPLE_GAP_MS : recorder.now - walk.startedAtMs > MAX_SAMPLE_GAP_MS);

  function explainLocation(start: () => Promise<void>) {
    Alert.alert('Record your walk',
      'walquest uses precise location, including while the screen is locked, during a walk you start. Points are saved on this phone. Pause or finish to stop recording. Allow background location when prompted.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: () => { void start(); } }]);
  }
  function share() {
    if (!walk) return;
    Alert.alert('Share precise location?', 'This export contains the coordinates and times of this walk. Choose where to share it.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: () => {
        void Share.share({ message: JSON.stringify(walk, null, 2), title: 'walquest recording' }).catch(() => Alert.alert('Could not share', 'Your recording is still saved on this phone.'));
      } },
    ]);
  }
  function remove() {
    Alert.alert('Delete this walk?', 'This removes its saved points from this phone.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void recorder.discard(); } },
    ]);
  }

  return <WalkScreen
    map={<WalkMap route={summary.route} center={summary.last?.coordinate} />}
    account={<AccountPanel />} status={walk?.status} hasWalk={!!walk} busy={recorder.busy}
    distance={formatDistanceM(summary.distanceM)} estimatedSteps={summary.estimatedSteps} sampleCount={summary.samples} segmentCount={walk?.segments.length ?? 0}
    lastFix={summary.last ? `${secondsSinceFix}s ago · ${summary.last.accuracyM === null ? 'accuracy unknown' : `${Math.round(summary.last.accuracyM)} m accuracy`}` : null}
    stale={stale} gapCount={summary.gaps} error={recorder.error ?? recorder.snapshot?.fault ?? null}
    onStart={() => explainLocation(recorder.start)} onResume={() => explainLocation(recorder.resume)}
    onPause={() => { void recorder.pause(); }} onFinish={() => { void recorder.finish(); }}
    onShare={share} onDelete={remove}
    onSettings={() => { void Linking.openSettings().catch(() => Alert.alert('Open Settings', 'Open your phone settings and find walquest to change location permissions.')); }}
  />;
}

import { Alert, Button, Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDistanceM } from '@walquest/domain/format';
import { WalkMap } from '../components/walk-map';
import { summarizeRecording } from '../recording/summary';
import { useRecorder } from '../recording/use-recorder';
import { MAX_SAMPLE_GAP_MS } from '../recording/store';
import { AccountPanel } from '../components/account-panel';

export default function HomeScreen() {
  const recorder = useRecorder();
  const walk = recorder.snapshot?.walk;
  const summary = summarizeRecording(walk);
  const recording = walk?.status === 'recording';
  const paused = walk?.status === 'paused';
  const saved = walk?.status === 'pending-submission';
  const secondsSinceFix = summary.last ? Math.max(0, Math.round((recorder.now - summary.last.timestampMs) / 1000)) : null;
  const stale = recording && (secondsSinceFix !== null ? secondsSinceFix * 1000 > MAX_SAMPLE_GAP_MS : recorder.now - walk.startedAtMs > MAX_SAMPLE_GAP_MS);

  function explainLocation(start: () => Promise<void>) {
    Alert.alert('Record your walk',
      'Walquest uses precise location, including while the screen is locked, during a walk you start. Points are saved on this phone. Pause or finish to stop recording. Allow background location when prompted.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: () => { void start(); } }]);
  }
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.heading}>
        <Text style={styles.title}>Walquest</Text>
        <Text style={styles.subtitle}>{recording ? 'Recording your walk' : paused ? 'Walk paused' : saved ? 'Walk saved on this phone' : 'Walk a loop. Claim your ground.'}</Text>
      </View>
      <WalkMap route={summary.route} center={summary.last?.coordinate} />
      <ScrollView style={styles.panel} contentContainerStyle={styles.content}>
        <Text style={styles.distance}>{formatDistanceM(summary.distanceM)}</Text>
        <Text>{summary.samples} saved points · {walk?.segments.length ?? 0} route segments</Text>
        {summary.last && <Text>Last saved point: {secondsSinceFix}s ago · accuracy {summary.last.accuracyM === null ? 'unknown' : `${Math.round(summary.last.accuracyM)} m`}</Text>}
        {stale && <Text style={styles.warning}>No recent location. Check permissions and location services; your route may have a gap.</Text>}
        {summary.gaps > 0 && <Text style={styles.warning}>{summary.gaps} location gap(s). Missing movement is excluded from the route and distance.</Text>}
        {(recorder.error || recorder.snapshot?.fault) && <Text accessibilityRole="alert" style={styles.warning}>{recorder.error ?? recorder.snapshot?.fault}</Text>}
        {!recording && !paused && <Button title="Start walk" disabled={recorder.busy} onPress={() => explainLocation(recorder.start)} />}
        {paused && <Button title="Resume walk" disabled={recorder.busy} onPress={() => explainLocation(recorder.resume)} />}
        {recording && <Button title="Pause walk" disabled={recorder.busy} onPress={() => { void recorder.pause(); }} />}
        {(recording || paused) && <Button title="Finish and save walk" disabled={recorder.busy} onPress={() => { void recorder.finish(); }} />}
        {walk && <Button title="Share recording data" disabled={recorder.busy} onPress={() => Alert.alert('Share precise location?', 'This export contains the coordinates and times of this walk. Choose where to share it.', [
          { text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: () => {
            void Share.share({ message: JSON.stringify(walk, null, 2), title: 'Walquest recording' }).catch(() => Alert.alert('Could not share', 'Your recording is still saved on this phone.'));
          } },
        ])} />}
        {walk && <Button title="Delete saved walk" color="#A6573F" disabled={recorder.busy} onPress={() => Alert.alert('Delete this walk?', 'This removes its saved points from this phone.', [
          { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void recorder.discard(); } },
        ])} />}
        {recorder.error && <Button title="Open phone settings" onPress={() => { void Linking.openSettings().catch(() => Alert.alert('Open Settings', 'Open your phone settings and find Walquest to change location permissions.')); }} />}
        <Text style={styles.note}>Recording preview: walks stay on this phone. Territory claiming will be connected in a later milestone.</Text>
        <AccountPanel />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F1E8' },
  heading: { padding: 16, gap: 4 },
  title: { fontSize: 28, fontWeight: '700', color: '#394434' },
  subtitle: { fontSize: 17, color: '#394434' },
  panel: { maxHeight: '48%' },
  content: { padding: 16, gap: 12 },
  distance: { fontSize: 28, fontWeight: '600', color: '#52684B' },
  warning: { color: '#923F2A', lineHeight: 22 },
  note: { fontSize: 14, lineHeight: 20, color: '#595C54' },
});

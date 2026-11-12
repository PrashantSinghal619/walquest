import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, ActionButton } from '../ui/primitives';
import { useMobileTheme } from '../ui/theme';
import type { WalkRecording } from '@walquest/domain/recording';
import { ASSUMED_STEP_LENGTH_M } from '../recording/summary';

export type WalkScreenProps = {
  map: ReactNode; account: ReactNode; status?: WalkRecording['status'];
  distance: string; estimatedSteps: number; sampleCount: number; segmentCount: number; lastFix: string | null;
  gapCount: number; stale: boolean; error: string | null; busy: boolean; hasWalk: boolean;
  onStart: () => void; onResume: () => void; onPause: () => void; onFinish: () => void;
  onShare: () => void; onDelete: () => void; onSettings: () => void;
};

export function WalkScreen(props: WalkScreenProps) {
  const { colors, dark, toggle } = useMobileTheme();
  const [sheet, setSheet] = useState<'account' | 'details' | null>(null);
  const recording = props.status === 'recording';
  const paused = props.status === 'paused';
  const saved = props.status === 'pending-submission';
  const stepCount = props.estimatedSteps.toLocaleString('en-IN');
  const stateLabel = recording ? 'Recording' : paused ? 'Walk paused' : saved ? 'Walk saved' : 'Ready to walk';
  const warning = props.error ?? (props.stale ? 'No recent location. Check location access; your saved points are kept.' : props.gapCount > 0 ? `${props.gapCount} location gap${props.gapCount === 1 ? '' : 's'}. Missing movement is excluded.` : null);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.brandRow}>
          <AppText accessibilityRole="header" weight="semibold" style={styles.brand}>walquest</AppText>
          <View style={[styles.headerDivider, { backgroundColor: colors.border }]} />
          <AppText weight="medium">Map</AppText>
        </View>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Switch to ${dark ? 'light' : 'dark'} theme`} onPress={toggle} style={styles.headerButton}>
            <AppText muted>{dark ? 'Light' : 'Dark'}</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setSheet('account')} style={styles.headerButton}>
            <AppText weight="medium">Account</AppText>
          </Pressable>
        </View>
      </View>

      <View style={styles.mapStage}>
        {props.map}
        <View pointerEvents="none" style={[styles.mapLabel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.routeSwatch, { backgroundColor: colors.route }]} />
          <AppText style={styles.small}>Your walking route</AppText>
        </View>
      </View>

      {/* Keep this in flow: the map retains its own space and attribution remains visible. */}
      <View style={[styles.walkPanel, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelContent}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryText}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: recording ? colors.positive : colors.muted }]} />
                <AppText muted>{props.busy ? 'Updating walk…' : stateLabel}</AppText>
              </View>
              <AppText weight="medium" style={styles.distance}>{props.distance}</AppText>
              <AppText muted style={styles.small}>≈ {stepCount} estimated steps</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Open walk details" onPress={() => setSheet('details')} style={styles.detailsButton}>
              <AppText weight="medium">Walk details</AppText>
              <AppText muted style={styles.small}>{props.sampleCount} saved points</AppText>
            </Pressable>
          </View>
          {!recording && !paused && <ActionButton title={saved ? 'Start another walk' : 'Start walk'} disabled={props.busy} onPress={props.onStart} />}
          {(recording || paused) && <View style={styles.controlRow}>
            <View style={styles.flex}><ActionButton title={paused ? 'Resume walk' : 'Pause walk'} disabled={props.busy} variant="secondary" onPress={paused ? props.onResume : props.onPause} /></View>
            <View style={styles.flex}><ActionButton title="Finish walk" disabled={props.busy} onPress={props.onFinish} /></View>
          </View>}
          {warning && <View style={[styles.warning, { backgroundColor: colors.notice }]}><AppText accessibilityRole="alert" style={{ color: colors.negative }}>{warning}</AppText></View>}
          <AppText muted style={[styles.small, styles.note]}>{recording ? 'Screen locked? Your walk keeps recording.' : paused ? 'Saved points are safe. Resume when you’re ready.' : saved ? 'Saved on this phone. Territory claiming is coming next.' : 'Walk a loop. Save your route on this phone.'}</AppText>
        </ScrollView>
      </View>

      <Modal visible={sheet !== null} animationType="slide" onRequestClose={() => setSheet(null)}>
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <AppText accessibilityRole="header" weight="semibold" style={styles.sheetTitle}>{sheet === 'account' ? 'Account' : 'Walk details'}</AppText>
              <ActionButton title="Done" variant="quiet" onPress={() => setSheet(null)} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
              {sheet === 'account' ? props.account : <>
                <AppText weight="medium" style={styles.sectionTitle}>{stateLabel}</AppText>
                <DetailRow label="Distance" value={props.distance} />
                <DetailRow label="Estimated steps" value={`≈ ${stepCount}`} />
                <AppText muted style={styles.small}>Estimated from recorded distance using an assumed {ASSUMED_STEP_LENGTH_M} m step length. This is not a sensor count; your step length and GPS accuracy affect the estimate. Missing route segments are excluded.</AppText>
                <DetailRow label="Saved points" value={String(props.sampleCount)} />
                <DetailRow label="Route segments" value={String(props.segmentCount)} />
                <DetailRow label="Last saved point" value={props.lastFix ?? 'No location saved yet'} />
                <AppText muted>Pauses and gaps longer than 30 seconds start a separate route segment. Missing movement is excluded from distance.</AppText>
                {props.hasWalk && <>
                  <View style={styles.section}><ActionButton title="Share recording data" variant="secondary" disabled={props.busy} onPress={props.onShare} /></View>
                  <AppText muted style={styles.small}>The export includes your precise route and timestamps.</AppText>
                  <View style={[styles.deleteSection, { borderTopColor: colors.border }]}>
                    <ActionButton title="Delete saved walk" variant="danger" disabled={props.busy} onPress={props.onDelete} />
                    <AppText muted style={styles.small}>Permanently removes this walk’s saved points from this phone.</AppText>
                  </View>
                </>}
                {(props.error || props.stale) && <ActionButton title="Open phone settings" variant="secondary" onPress={props.onSettings} />}
              </>}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useMobileTheme();
  return <View style={[styles.detailRow, { borderBottomColor: colors.border }]}><AppText muted style={styles.flex}>{label}</AppText><AppText weight="medium" style={styles.detailValue}>{value}</AppText></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, flex: { flex: 1 },
  header: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, gap: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, brand: { fontSize: 20, lineHeight: 28, letterSpacing: -0.6 },
  headerDivider: { width: 1, height: 20 }, headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { minHeight: 48, minWidth: 44, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  mapStage: { flex: 1, minHeight: 100 },
  mapLabel: { position: 'absolute', top: 16, left: 16, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeSwatch: { width: 16, height: 3, borderRadius: 2 },
  walkPanel: { borderTopWidth: 1, maxHeight: '50%' }, panelScroll: { flexGrow: 0 }, panelContent: { padding: 20, gap: 12 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, summaryText: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, statusDot: { width: 6, height: 6, borderRadius: 3 },
  distance: { fontSize: 30, lineHeight: 38, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  detailsButton: { minHeight: 48, justifyContent: 'center', alignItems: 'flex-end', paddingVertical: 4 }, small: { fontSize: 12, lineHeight: 18 },
  warning: { padding: 12, borderRadius: 8 }, controlRow: { flexDirection: 'row', gap: 12 }, note: { textAlign: 'center' },
  sheetHeader: { paddingHorizontal: 20, minHeight: 72, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 22, lineHeight: 30, letterSpacing: -0.4 }, sheetContent: { padding: 24, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  sectionTitle: { fontSize: 18, lineHeight: 26 }, detailRow: { paddingVertical: 12, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  detailValue: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }, section: { marginTop: 16 }, deleteSection: { borderTopWidth: 1, marginTop: 16, paddingTop: 16, gap: 8 },
});

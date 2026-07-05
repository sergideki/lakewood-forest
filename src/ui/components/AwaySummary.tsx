import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { theme } from '../theme';
import type { AwayReport } from '../../lib/awayReport';
import { getDungeon, getHabitat } from '../../engine/content';

interface Props {
  report: AwayReport;
  onDismiss: () => void;
}

function humanizeElapsed(sec: number): string {
  const s = Math.floor(sec);
  if (s < 60) return 'just now';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

export function AwaySummary({ report, onDismiss }: Props) {
  const gold = Math.floor(report.barn.gold);
  const wood = Math.floor(report.barn.wood + report.satchel.wood);
  const acorns = Math.floor(report.barn.acorns + report.satchel.acorn);
  const fish = Math.floor(report.creel.fish);
  const drained = Math.floor(report.marigoldFishDrained);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      {/* Separate absolute backdrop + centered sheet: taps on the sheet never
          reach the backdrop, so an inner tap doesn't dismiss (mirrors PlotGrid's
          crop-picker modal). */}
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <View style={styles.sheet}>
          <Text style={styles.title}>🌿 Welcome back!</Text>
          <Text style={styles.sub}>You were away {humanizeElapsed(report.elapsedSec)}</Text>

          <View style={styles.gains}>
            {gold > 0 && <Text style={styles.line}>🪙 +{gold}</Text>}
            {wood > 0 && <Text style={styles.line}>🪵 +{wood}</Text>}
            {acorns > 0 && <Text style={styles.line}>🌰 +{acorns}</Text>}
            {fish > 0 && <Text style={styles.line}>🐟 +{fish}</Text>}
            {report.readyDungeons.map((id) => {
              const d = getDungeon(id);
              return d ? <Text key={id} style={styles.line}>🍄 {d.name} is ready</Text> : null;
            })}
            {report.readyHabitats.map((id) => {
              const h = getHabitat(id);
              return h ? <Text key={id} style={styles.line}>🪷 {h.name} is ready</Text> : null;
            })}
          </View>

          {drained > 0 && <Text style={styles.drained}>🌼 marigolds sipped {drained}🐟</Text>}

          <Pressable style={styles.btn} onPress={onDismiss}>
            <Text style={styles.btnText}>Nice!</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    width: '100%', maxWidth: 360, backgroundColor: theme.card,
    borderColor: theme.accent, borderWidth: 2, borderRadius: 18, padding: 20, alignItems: 'center',
  },
  title: { color: theme.accent, fontSize: 18, fontWeight: '800' },
  sub: { color: theme.textDim, fontSize: 13, marginTop: 4, marginBottom: 14 },
  gains: { alignSelf: 'stretch', gap: 6 },
  line: { color: theme.text, fontSize: 15, fontWeight: '600' },
  drained: { color: theme.textDim, fontSize: 12, marginTop: 10 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 10, marginTop: 18 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 14 },
});

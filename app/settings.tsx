import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../src/ui/theme';
import { cards } from '../src/ui/styles';
import { ResourceBar } from '../src/ui/components/ResourceBar';
import { useGameStore } from '../src/store/gameStore';
import { RELEASES_LATEST_API, parseRelease, isNewer, type ReleaseInfo } from '../src/lib/updates';

const CURRENT_VERSION = Constants.expoConfig?.version ?? '0.0.0';

type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'latest'; version: string }
  | { kind: 'available'; info: ReleaseInfo }
  | { kind: 'error'; message: string };

export default function Settings() {
  const exportState = useGameStore((s) => s.exportState);
  const importState = useGameStore((s) => s.importState);

  const [backup, setBackup] = useState('');
  const [importText, setImportText] = useState('');
  const [status, setStatus] = useState('');
  const [update, setUpdate] = useState<UpdateState>({ kind: 'idle' });
  const [installing, setInstalling] = useState(false);

  const doExport = async () => {
    const blob = exportState();
    setBackup(blob);
    try {
      await Clipboard.setStringAsync(blob);
      setStatus('Backup copied to clipboard.');
    } catch {
      setStatus('Backup shown below — select and copy it.');
    }
  };

  const doImport = () => {
    const text = importText.trim();
    if (!text) { setStatus('Paste a backup into the box first.'); return; }
    const ok = importState(text);
    setStatus(ok ? '✅ Backup restored.' : '❌ That is not a valid Lakewood backup — nothing changed.');
    if (ok) setImportText('');
  };

  const checkForUpdates = async () => {
    setUpdate({ kind: 'checking' });
    try {
      const res = await fetch(RELEASES_LATEST_API, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
      const info = parseRelease(await res.json());
      if (!info) { setUpdate({ kind: 'error', message: 'No release info available.' }); return; }
      setUpdate(isNewer(info.version, CURRENT_VERSION) ? { kind: 'available', info } : { kind: 'latest', version: info.version });
    } catch (e) {
      setUpdate({ kind: 'error', message: e instanceof Error ? e.message : 'Update check failed.' });
    }
  };

  const downloadAndInstall = async (info: ReleaseInfo) => {
    // Non-Android (or no APK asset): just open the release page in the browser.
    if (Platform.OS !== 'android' || !info.apkUrl) {
      Linking.openURL(info.htmlUrl);
      return;
    }
    setInstalling(true);
    setStatus('Downloading update…');
    try {
      // Dynamic import keeps these Android-native modules out of the web bundle.
      // Legacy submodule: expo-file-system v57's default export moved to a new File/Paths API;
      // downloadAsync + getContentUriAsync (needed for the install intent) live in /legacy.
      const FileSystem = await import('expo-file-system/legacy');
      const IntentLauncher = await import('expo-intent-launcher');
      const target = `${FileSystem.cacheDirectory}lakewood-update.apk`;
      const { uri } = await FileSystem.downloadAsync(info.apkUrl, target);
      const contentUri = await FileSystem.getContentUriAsync(uri);
      setStatus('Opening installer…');
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive',
      });
      setStatus('Follow the Android prompt to finish installing.');
    } catch (e) {
      // Fall back to the release page so the user can always get the APK manually.
      setStatus('Auto-install failed — opening the release page.');
      Linking.openURL(info.htmlUrl);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ResourceBar />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Updates */}
        <View style={cards.card}>
          <Text style={cards.title}>⬆️ Updates</Text>
          <Text style={cards.sub}>Installed version: v{CURRENT_VERSION}</Text>
          <Pressable
            style={[styles.btn, update.kind === 'checking' && styles.btnDisabled]}
            disabled={update.kind === 'checking'}
            onPress={checkForUpdates}
          >
            <Text style={styles.btnText}>{update.kind === 'checking' ? 'Checking…' : 'Check for updates'}</Text>
          </Pressable>
          {update.kind === 'latest' && <Text style={styles.ok}>You're on the latest version (v{update.version}).</Text>}
          {update.kind === 'error' && <Text style={styles.err}>Couldn't check: {update.message}</Text>}
          {update.kind === 'available' && (
            <>
              <Text style={styles.ok}>Update available: v{update.info.version}</Text>
              <Pressable
                style={[styles.btn, installing && styles.btnDisabled]}
                disabled={installing}
                onPress={() => downloadAndInstall(update.info)}
              >
                <Text style={styles.btnText}>
                  {installing ? 'Working…' : Platform.OS === 'android' && update.info.apkUrl ? '⬇️ Download & install' : 'Open release page'}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Backup */}
        <View style={cards.card}>
          <Text style={cards.title}>💾 Backup</Text>
          <Text style={cards.sub}>Export copies your save; keep it somewhere safe.</Text>
          <Pressable style={styles.btn} onPress={doExport}>
            <Text style={styles.btnText}>Export save</Text>
          </Pressable>
          {backup !== '' && (
            <TextInput
              style={styles.blob}
              value={backup}
              editable={false}
              multiline
              selectTextOnFocus
            />
          )}
        </View>

        {/* Restore */}
        <View style={cards.card}>
          <Text style={cards.title}>♻️ Restore</Text>
          <Text style={cards.sub}>Paste a backup and load it. A bad paste won't touch your current save.</Text>
          <TextInput
            style={styles.blob}
            value={importText}
            onChangeText={setImportText}
            placeholder="Paste your backup here…"
            placeholderTextColor={theme.textDim}
            multiline
          />
          <Pressable style={styles.btn} onPress={doImport}>
            <Text style={styles.btnText}>Load backup</Text>
          </Pressable>
        </View>

        {status !== '' && <Text style={styles.status}>{status}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center', marginTop: 10 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
  blob: { marginTop: 10, minHeight: 80, maxHeight: 160, borderColor: theme.cardBorder, borderWidth: 1, borderRadius: 10,
    padding: 10, color: theme.text, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', textAlignVertical: 'top' },
  ok: { color: theme.accent, fontSize: 13, marginTop: 8, fontWeight: '600' },
  err: { color: '#e0794f', fontSize: 12, marginTop: 8 },
  status: { color: theme.textDim, fontSize: 12, marginHorizontal: 16, marginTop: 4, textAlign: 'center' },
});

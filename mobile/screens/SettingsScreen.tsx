/**
 * mobile/screens/SettingsScreen.tsx
 *
 * Game Settings, Configurable LAN Server URL & Connectivity Test, and Account Preferences.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, StyleSheet, Alert, TextInput } from 'react-native';
import Colors from '../theme/colors';
import Spacing from '../theme/spacing';
import Card from '../components/Card';
import Button from '../components/Button';
import { apiClient } from '../services/apiClient';
import { socketService } from '../services/socketService';
import { storageService, STORAGE_KEYS } from '../services/storageService';
import { normalizeServerUrl } from '../constants/config';

export interface SettingsScreenProps {
  onBack?: () => void;
  onServerUrlChanged?: (url: string) => void;
  onSignOut?: () => void;
}

export function SettingsScreen({ onBack, onServerUrlChanged, onSignOut }: SettingsScreenProps) {
  const [soundEffects, setSoundEffects] = useState<boolean>(true);
  const [music, setMusic] = useState<boolean>(true);
  const [vibrations, setVibrations] = useState<boolean>(true);
  const [pushNotifications, setPushNotifications] = useState<boolean>(true);
  const [serverUrlInput, setServerUrlInput] = useState<string>(apiClient.getBaseUrl());
  const [connectionInfo, setConnectionInfo] = useState<string>('Not tested yet');
  const [testing, setTesting] = useState<boolean>(false);

  useEffect(() => {
    storageService.getItem(STORAGE_KEYS.SERVER_URL).then((saved) => {
      if (saved) setServerUrlInput(saved);
    });
  }, []);

  const handleSaveAndTestServer = async () => {
    const clean = normalizeServerUrl(serverUrlInput);
    setTesting(true);
    setConnectionInfo('Testing server reachability...');
    apiClient.setBaseUrl(clean);
    socketService.setServerHttpUrl(clean);
    await storageService.setItem(STORAGE_KEYS.SERVER_URL, clean);
    setServerUrlInput(clean);

    try {
      const health = await apiClient.getServerHealth();
      const dbText = health?.database?.connected ? 'PostgreSQL Online' : 'Fallback Mode (DB Offline)';
      setConnectionInfo(`Connected (${health?.status || 'ok'}) • ${dbText}`);
      onServerUrlChanged && onServerUrlChanged(clean);
    } catch (err: any) {
      setConnectionInfo(`Unreachable: ${err?.message || 'Check LAN IP / Firewall'}`);
      Alert.alert('Connection Error', `Could not reach ${clean}. On a physical phone, use your computer's LAN IP (e.g. http://192.168.1.5:3000).`);
    } finally {
      setTesting(false);
    }
  };

  const handleLogout = () => {
    onSignOut && onSignOut();
    Alert.alert('Session Reset', 'Starting a fresh player session.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        {onBack && (
          <Button title="← Back" variant="secondary" size="small" onPress={onBack} />
        )}
        <Text style={styles.title}>Game Settings</Text>
      </View>

      {/* Server & LAN URL Configuration */}
      <Card style={styles.card}>
        <Text style={styles.sectionHeader}>Server Connection (LAN / Emulator)</Text>
        <Text style={styles.helperText}>
          Emulator: http://10.0.2.2:3000 • Physical Device: http://YOUR-LAN-IP:3000
        </Text>
        <TextInput
          style={styles.urlInput}
          value={serverUrlInput}
          onChangeText={setServerUrlInput}
          placeholder="http://192.168.1.10:3000"
          placeholderTextColor={Colors.slate}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.statusText}>{connectionInfo}</Text>
        <Button
          title={testing ? 'Testing...' : 'Save & Test Connection'}
          variant="primary"
          size="small"
          disabled={testing}
          onPress={handleSaveAndTestServer}
        />
      </Card>

      {/* Audio & Haptics */}
      <Card style={styles.card}>
        <Text style={styles.sectionHeader}>Audio & Haptics</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Sound Effects</Text>
          <Switch
            value={soundEffects}
            onValueChange={setSoundEffects}
            trackColor={{ false: Colors.secondaryBlue, true: Colors.royalBlue }}
            thumbColor={soundEffects ? Colors.gold : Colors.slate}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Arena Background Music</Text>
          <Switch
            value={music}
            onValueChange={setMusic}
            trackColor={{ false: Colors.secondaryBlue, true: Colors.royalBlue }}
            thumbColor={music ? Colors.gold : Colors.slate}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Haptic Feedback on Number Strike</Text>
          <Switch
            value={vibrations}
            onValueChange={setVibrations}
            trackColor={{ false: Colors.secondaryBlue, true: Colors.royalBlue }}
            thumbColor={vibrations ? Colors.gold : Colors.slate}
          />
        </View>
      </Card>

      {/* Notifications */}
      <Card style={styles.card}>
        <Text style={styles.sectionHeader}>Push Notifications</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Tournament Match Reminders</Text>
          <Switch
            value={pushNotifications}
            onValueChange={setPushNotifications}
            trackColor={{ false: Colors.secondaryBlue, true: Colors.royalBlue }}
            thumbColor={pushNotifications ? Colors.gold : Colors.slate}
          />
        </View>
      </Card>

      {/* Account & Support */}
      <Card style={styles.card}>
        <Text style={styles.sectionHeader}>Account & Support</Text>

        <Button
          title="Game Rules & Tutorial ❓"
          variant="secondary"
          size="medium"
          onPress={() => Alert.alert('Rules', 'Arrange 1-25 on a 5x5 grid. Complete 5 horizontal or vertical lines to claim BINGO!')}
          style={{ marginBottom: 8 }}
        />

        <Button
          title="Reset / Switch Session"
          variant="danger"
          size="medium"
          onPress={handleLogout}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 32 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: Colors.premiumWhite, fontSize: 18, fontWeight: '900' },
  card: { padding: Spacing.md },
  sectionHeader: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8
  },
  helperText: { color: Colors.slate, fontSize: 11, marginBottom: 8 },
  urlInput: {
    backgroundColor: Colors.deepNavy,
    borderWidth: 1,
    borderColor: Colors.borderHighlight,
    borderRadius: 10,
    color: Colors.premiumWhite,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 8
  },
  statusText: { color: Colors.cyan, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 149, 168, 0.1)'
  },
  settingLabel: { color: Colors.premiumWhite, fontSize: 13, fontWeight: '700' }
});

export default SettingsScreen;

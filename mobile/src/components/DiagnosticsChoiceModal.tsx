import React, { useEffect, useState } from 'react';
import { Modal, Switch, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button, Card, Row } from './ui';

export function DiagnosticsChoiceModal({
  visible,
  initialCrashReports,
  initialSessionReplay,
  onConfirm,
}: {
  visible: boolean;
  initialCrashReports: boolean;
  initialSessionReplay: boolean;
  onConfirm: (choices: { crashReports: boolean; sessionReplay: boolean }) => void;
}) {
  const theme = useTheme();
  const [crashReports, setCrashReports] = useState(initialCrashReports);
  const [sessionReplay, setSessionReplay] = useState(initialSessionReplay);

  useEffect(() => {
    if (!visible) return;
    setCrashReports(initialCrashReports);
    setSessionReplay(initialSessionReplay);
  }, [initialCrashReports, initialSessionReplay, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 20,
          backgroundColor: 'rgba(0,0,0,0.62)',
        }}
      >
        <Card style={{ gap: 14 }} accessibilityViewIsModal>
          <AppText variant="h2">Help improve Australian Rates</AppText>
          <AppText variant="small" color="textMuted" style={{ lineHeight: 20 }}>
            These privacy choices are preselected. Nothing is collected until you continue, and
            either choice can be turned off now or later in Settings.
          </AppText>

          <Row style={{ alignItems: 'flex-start' }} gap={12}>
            <View style={{ flex: 1 }}>
              <AppText weight="700">Crash and performance reports</AppText>
              <AppText variant="tiny" color="textMuted" style={{ lineHeight: 18 }}>
                Sends technical crashes and a bounded, deidentified performance summary. Raw
                traces, routes, searches, saved products, profile and calculator inputs stay out.
              </AppText>
            </View>
            <Switch
              accessibilityLabel="Crash and performance reports"
              value={crashReports}
              onValueChange={setCrashReports}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </Row>

          <Row style={{ alignItems: 'flex-start' }} gap={12}>
            <View style={{ flex: 1 }}>
              <AppText weight="700">Clarity interaction replay</AppText>
              <AppText variant="tiny" color="textMuted" style={{ lineHeight: 18 }}>
                Records interactions only on approved public browsing screens. Search, profile,
                calculators, saved items, diagnostics and account screens are always excluded.
              </AppText>
            </View>
            <Switch
              accessibilityLabel="Clarity interaction replay"
              value={sessionReplay}
              onValueChange={setSessionReplay}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </Row>

          <Button
            title="Continue"
            onPress={() => onConfirm({ crashReports, sessionReplay })}
          />
          <Button
            title="Keep both off"
            variant="ghost"
            onPress={() => onConfirm({ crashReports: false, sessionReplay: false })}
          />
        </Card>
      </View>
    </Modal>
  );
}

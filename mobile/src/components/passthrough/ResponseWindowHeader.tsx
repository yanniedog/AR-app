import Ionicons from '../icons/AppIcon';
import React, { useMemo } from 'react';
import { PanResponder, Pressable, View } from 'react-native';

import type { MultiSectionPassThroughModel, RbaDecisionRef } from '../../data/bankInsights';
import { uiCount, uiDate, uiJoin, uiLabel } from '../../lib/uiCopy';
import { uiChartBps } from '../../lib/chartUiCopy';
import {
  RESPONSE_WINDOW_SWIPE_THRESHOLD_PX,
  responseWindowSwipeDirection,
} from '../../data/passThroughModels';
import { hapticSelection } from '../../lib/haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Badge, Card, Row } from '../ui';

function ArrowButton({
  direction,
  disabled,
  onPress,
}: {
  direction: 'older' | 'newer';
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={uiJoin(direction === 'older' ? 'Previous date' : 'Next date', ' · ', 'Response window')}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled ? theme.colors.surfaceAlt : theme.colors.primaryMuted,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Ionicons
        name={direction === 'older' ? 'chevron-back' : 'chevron-forward'}
        size={22}
        color={disabled ? theme.colors.textFaint : theme.colors.primary}
      />
    </Pressable>
  );
}

export function ResponseWindowHeader({
  model,
  decisions,
  onDecisionChange,
}: {
  model: MultiSectionPassThroughModel;
  decisions: RbaDecisionRef[];
  onDecisionChange: (date: string) => void;
}) {
  const theme = useTheme();
  const decisionIndex = Math.max(
    0,
    decisions.findIndex((decision) => decision.date === model.decision.date),
  );
  const newer = decisions[decisionIndex - 1];
  const older = decisions[decisionIndex + 1];
  const move = (decision: RbaDecisionRef | undefined) => {
    if (!decision) return;
    hapticSelection();
    onDecisionChange(decision.date);
  };
  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) >= RESPONSE_WINDOW_SWIPE_THRESHOLD_PX &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.35,
      onPanResponderRelease: (_, gesture) => {
        const direction = responseWindowSwipeDirection(gesture.dx);
        if (direction === 'older') move(older);
        if (direction === 'newer') move(newer);
      },
    }),
    // The responder must be rebuilt when the adjacent windows change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [newer?.date, older?.date],
  );
  const direction = uiLabel(model.decision.bps > 0 ? 'Hike' : 'Cut');
  const position = decisions.length ? uiJoin(uiCount(decisionIndex + 1), '/', uiCount(decisions.length)) : uiLabel('Unknown');
  const statusLabel = uiLabel(model.windowOpen ? 'Open window' : 'Closed window');
  const statusTone = model.windowOpen ? 'primary' : 'success';

  return (
    <Card
      variant="outlined"
      style={{ marginBottom: 14, overflow: 'hidden' }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Badge label={statusLabel} tone={statusTone} />
        <AppText variant="tiny" color="textFaint" weight="700">
          {position}
        </AppText>
      </Row>

      <Row gap={12} style={{ marginTop: 16, alignItems: 'center' }}>
        <ArrowButton direction="older" disabled={!older} onPress={() => move(older)} />
        <View
          style={{ flex: 1, alignItems: 'center' }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={uiJoin(statusLabel, ' · ', 'RBA', ' ', direction, ' ', uiChartBps(model.decision.bps), ' · ', uiDate(model.decision.date), ' · ', 'Window', ' ', position)}
          accessibilityActions={[
            { name: 'decrement', label: 'Previous date' },
            { name: 'increment', label: 'Next date' },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'decrement') move(older);
            if (event.nativeEvent.actionName === 'increment') move(newer);
          }}
          {...panResponder.panHandlers}
        >
          <AppText variant="tiny" color="textMuted" weight="700">
            {uiDate(model.decision.date)}
          </AppText>
          <AppText variant="h1" style={{ marginTop: 2 }}>
            {uiChartBps(model.decision.bps)}
          </AppText>
          <AppText variant="small" color="textMuted">
            {uiJoin('Cash rate', ' · ', direction)}
          </AppText>
        </View>
        <ArrowButton direction="newer" disabled={!newer} onPress={() => move(newer)} />
      </Row>

      <View
        style={{
          marginTop: 16,
          height: 3,
          borderRadius: 2,
          backgroundColor: theme.colors.border,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: model.windowOpen ? theme.colors.primary : theme.colors.success,
          }}
        />
      </View>
      <Row style={{ marginTop: 7, justifyContent: 'space-between' }}>
        <AppText variant="tiny" color="textFaint">{uiLabel("Decision")}</AppText>
        <AppText variant="tiny" color="textFaint">
          {uiJoin('Tracked to', ' · ', uiDate(model.windowOpen ? model.observedThrough : model.windowEnd))}
        </AppText>
      </Row>
      {model.decision.partialObservation ? (
        <AppText variant="tiny" color="warning" style={{ marginTop: 10 }}>
          {uiJoin('Partial', ' · ', 'Response', ' · ', '≤', ' ', 'days')}
        </AppText>
      ) : null}
    </Card>
  );
}

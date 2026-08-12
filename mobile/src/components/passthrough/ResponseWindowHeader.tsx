import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { PanResponder, Pressable, View } from 'react-native';

import type { MultiSectionPassThroughModel, RbaDecisionRef } from '../../data/bankInsights';
import { formatRunDate } from '../../data/format';
import {
  passThroughEvidenceLabel,
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
      accessibilityLabel={`${direction === 'older' ? 'Previous' : 'Next'} RBA response window`}
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
        Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.35,
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
  const direction = model.decision.bps > 0 ? 'increase' : 'cut';
  const position = decisions.length ? `${decisionIndex + 1} of ${decisions.length}` : '';
  const statusLabel = model.windowOpen ? 'Current window · live' : 'Complete window';
  const statusTone = model.windowOpen ? 'primary' : 'success';

  return (
    <Card
      variant="outlined"
      style={{ marginBottom: 14, overflow: 'hidden' }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Badge label={statusLabel} tone={statusTone} />
        <AppText variant="tiny" color="textFaint" weight="700">
          {position.toUpperCase()}
        </AppText>
      </Row>

      <Row gap={12} style={{ marginTop: 16, alignItems: 'center' }}>
        <ArrowButton direction="older" disabled={!older} onPress={() => move(older)} />
        <View
          style={{ flex: 1, alignItems: 'center' }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${statusLabel}. RBA ${direction} of ${Math.abs(model.decision.bps)} basis points on ${formatRunDate(model.decision.date)}. Window ${position}.`}
          accessibilityHint="Swipe left or right, or use the arrow buttons, to change response window."
          accessibilityActions={[
            { name: 'decrement', label: 'Previous response window' },
            { name: 'increment', label: 'Next response window' },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'decrement') move(older);
            if (event.nativeEvent.actionName === 'increment') move(newer);
          }}
          {...panResponder.panHandlers}
        >
          <AppText variant="tiny" color="textMuted" weight="700">
            {formatRunDate(model.decision.date).toUpperCase()}
          </AppText>
          <AppText variant="h1" style={{ marginTop: 2 }}>
            {model.decision.bps > 0 ? '+' : '−'}{Math.abs(model.decision.bps)} bp
          </AppText>
          <AppText variant="small" color="textMuted">
            cash-rate {direction}
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
        <AppText variant="tiny" color="textFaint">Decision</AppText>
        <AppText variant="tiny" color="textFaint">
          {model.windowOpen
            ? `Tracked to ${formatRunDate(model.observedThrough)}`
            : `Tracked to ${formatRunDate(model.windowEnd)}`}
        </AppText>
      </Row>
      {model.decision.partialObservation ? (
        <AppText variant="tiny" color="warning" style={{ marginTop: 10 }}>
          {passThroughEvidenceLabel(model)} — tracking began after this decision.
        </AppText>
      ) : null}
    </Card>
  );
}

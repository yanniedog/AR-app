export type AppLockLifecycle = 'active' | 'inactive' | 'background' | 'unknown';

export type AppLockPromptKind = 'automatic' | 'manual';

export type AppLockPromptAttempt = {
  id: number;
  epoch: number;
};

export type AppLockMachineState = {
  required: boolean;
  lifecycle: AppLockLifecycle;
  locked: boolean;
  epoch: number;
  autoPromptedEpoch: number | null;
  promptAttempt: AppLockPromptAttempt | null;
  nextAttemptId: number;
};

export type AppLockEvent =
  | { type: 'set_required'; required: boolean }
  | { type: 'app_state_changed'; lifecycle: AppLockLifecycle }
  | { type: 'prompt_started'; kind: AppLockPromptKind }
  | { type: 'prompt_resolved'; attemptId: number; success: boolean };

export function normalizeAppLockLifecycle(
  lifecycle: string | null | undefined,
): AppLockLifecycle {
  if (lifecycle === 'active' || lifecycle === 'inactive' || lifecycle === 'background') {
    return lifecycle;
  }
  return 'unknown';
}

export function createAppLockState(
  required: boolean,
  lifecycle: AppLockLifecycle,
): AppLockMachineState {
  return {
    required,
    lifecycle,
    locked: required,
    epoch: 0,
    autoPromptedEpoch: null,
    promptAttempt: null,
    nextAttemptId: 1,
  };
}

function canStartPrompt(state: AppLockMachineState): boolean {
  return (
    state.required &&
    state.locked &&
    state.lifecycle === 'active' &&
    state.promptAttempt === null
  );
}

export function shouldAutomaticallyPrompt(state: AppLockMachineState): boolean {
  return canStartPrompt(state) && state.autoPromptedEpoch !== state.epoch;
}

/**
 * Pure app-lock state machine. Every lifecycle/configuration change advances an
 * epoch, so an authentication result that returns after the app was obscured or
 * the lock was disabled can never unlock a newer foreground session.
 */
export function reduceAppLockState(
  state: AppLockMachineState,
  event: AppLockEvent,
): AppLockMachineState {
  switch (event.type) {
    case 'set_required':
      if (event.required === state.required) return state;
      return {
        ...state,
        required: event.required,
        locked: event.required,
        epoch: state.epoch + 1,
        autoPromptedEpoch: null,
        promptAttempt: null,
      };

    case 'app_state_changed':
      if (event.lifecycle === state.lifecycle) return state;
      return {
        ...state,
        lifecycle: event.lifecycle,
        locked: state.required,
        epoch: state.epoch + 1,
        autoPromptedEpoch: null,
        promptAttempt: null,
      };

    case 'prompt_started': {
      if (!canStartPrompt(state)) return state;
      const promptAttempt = { id: state.nextAttemptId, epoch: state.epoch };
      return {
        ...state,
        promptAttempt,
        nextAttemptId: state.nextAttemptId + 1,
        autoPromptedEpoch:
          event.kind === 'automatic' ? state.epoch : state.autoPromptedEpoch,
      };
    }

    case 'prompt_resolved': {
      if (state.promptAttempt?.id !== event.attemptId) return state;
      const resultStillCurrent =
        event.success &&
        state.required &&
        state.lifecycle === 'active' &&
        state.promptAttempt.epoch === state.epoch;
      return {
        ...state,
        locked: state.required ? !resultStillCurrent : false,
        promptAttempt: null,
      };
    }
  }
}

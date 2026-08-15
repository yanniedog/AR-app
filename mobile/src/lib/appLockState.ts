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
  promptInterruption: boolean;
  pendingAuthentication: boolean;
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
    promptInterruption: false,
    pendingAuthentication: false,
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
 * Pure app-lock state machine. Every privacy-invalidating lifecycle or
 * configuration change advances an epoch, so an authentication result that
 * returns after a real background transition or lock disablement can never
 * unlock a newer foreground session. Prompt-driven inactivity retains the
 * attempt only until the prompt settles or the app actually backgrounds.
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
        promptInterruption: false,
        pendingAuthentication: false,
      };

    case 'app_state_changed': {
      if (event.lifecycle === state.lifecycle) return state;

      // Native biometric/device-credential UI can itself move iOS to
      // `inactive`. Lock the content immediately, but retain that attempt and
      // epoch until the prompt settles or a real `background` transition
      // invalidates it.
      if (event.lifecycle === 'inactive' && state.promptAttempt) {
        return {
          ...state,
          lifecycle: 'inactive',
          locked: state.required,
          promptInterruption: true,
        };
      }

      if (event.lifecycle === 'active' && state.promptInterruption) {
        return {
          ...state,
          lifecycle: 'active',
          locked: state.required ? !state.pendingAuthentication : false,
          promptInterruption: false,
          pendingAuthentication: false,
        };
      }

      return {
        ...state,
        lifecycle: event.lifecycle,
        locked: state.required,
        epoch: state.epoch + 1,
        autoPromptedEpoch: null,
        promptAttempt: null,
        promptInterruption: false,
        pendingAuthentication: false,
      };
    }

    case 'prompt_started': {
      if (!canStartPrompt(state)) return state;
      const promptAttempt = { id: state.nextAttemptId, epoch: state.epoch };
      return {
        ...state,
        promptAttempt,
        nextAttemptId: state.nextAttemptId + 1,
        // A failed manual prompt must not be followed immediately by an
        // automatic prompt in the same foreground epoch.
        autoPromptedEpoch: state.epoch,
      };
    }

    case 'prompt_resolved': {
      if (state.promptAttempt?.id !== event.attemptId) return state;
      const attemptStillCurrent =
        state.required && state.promptAttempt.epoch === state.epoch;
      if (
        event.success &&
        attemptStillCurrent &&
        state.lifecycle === 'inactive' &&
        state.promptInterruption
      ) {
        return {
          ...state,
          locked: true,
          promptAttempt: null,
          pendingAuthentication: true,
        };
      }
      const resultStillCurrent =
        event.success &&
        attemptStillCurrent &&
        state.lifecycle === 'active' &&
        !state.promptInterruption;
      return {
        ...state,
        locked: state.required ? !resultStillCurrent : false,
        promptAttempt: null,
        pendingAuthentication: false,
      };
    }
  }
}

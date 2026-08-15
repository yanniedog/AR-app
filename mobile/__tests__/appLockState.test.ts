import {
  createAppLockState,
  reduceAppLockState,
  shouldAutomaticallyPrompt,
} from '../src/lib/appLockState';

describe('app lock state machine', () => {
  it('unlocks only after a successful current-foreground authentication', () => {
    let state = createAppLockState(true, 'active');
    expect(state.locked).toBe(true);
    expect(shouldAutomaticallyPrompt(state)).toBe(true);

    state = reduceAppLockState(state, { type: 'prompt_started', kind: 'automatic' });
    const attemptId = state.promptAttempt?.id;
    expect(attemptId).toBeDefined();

    state = reduceAppLockState(state, {
      type: 'prompt_resolved',
      attemptId: attemptId!,
      success: true,
    });
    expect(state.locked).toBe(false);
    expect(state.promptAttempt).toBeNull();
  });

  it('relocks immediately on inactive/background and prompts only after returning active', () => {
    let state = createAppLockState(true, 'active');
    state = reduceAppLockState(state, { type: 'prompt_started', kind: 'automatic' });
    state = reduceAppLockState(state, {
      type: 'prompt_resolved',
      attemptId: state.promptAttempt!.id,
      success: true,
    });

    state = reduceAppLockState(state, { type: 'app_state_changed', lifecycle: 'inactive' });
    expect(state.locked).toBe(true);
    expect(shouldAutomaticallyPrompt(state)).toBe(false);
    expect(
      reduceAppLockState(state, { type: 'prompt_started', kind: 'manual' }),
    ).toBe(state);

    state = reduceAppLockState(state, { type: 'app_state_changed', lifecycle: 'background' });
    expect(state.locked).toBe(true);
    expect(shouldAutomaticallyPrompt(state)).toBe(false);

    state = reduceAppLockState(state, { type: 'app_state_changed', lifecycle: 'active' });
    expect(state.locked).toBe(true);
    expect(shouldAutomaticallyPrompt(state)).toBe(true);
  });

  it('keeps a real app-switch cancellation locked and ignores its stale success', () => {
    let state = createAppLockState(true, 'active');
    state = reduceAppLockState(state, { type: 'prompt_started', kind: 'automatic' });
    const staleAttemptId = state.promptAttempt!.id;

    state = reduceAppLockState(state, { type: 'app_state_changed', lifecycle: 'inactive' });
    expect(state.promptAttempt?.id).toBe(staleAttemptId);
    state = reduceAppLockState(state, { type: 'app_state_changed', lifecycle: 'background' });
    expect(state.promptAttempt?.id).toBe(staleAttemptId);
    state = reduceAppLockState(state, {
      type: 'prompt_resolved',
      attemptId: staleAttemptId,
      success: false,
    });
    expect(state.promptAttempt).toBeNull();
    state = reduceAppLockState(state, { type: 'app_state_changed', lifecycle: 'active' });
    expect(shouldAutomaticallyPrompt(state)).toBe(false);

    const afterStaleSuccess = reduceAppLockState(state, {
      type: 'prompt_resolved',
      attemptId: staleAttemptId,
      success: true,
    });
    expect(afterStaleSuccess).toBe(state);
    expect(afterStaleSuccess.locked).toBe(true);

    state = reduceAppLockState(state, { type: 'prompt_started', kind: 'manual' });
    const freshAttemptId = state.promptAttempt!.id;
    expect(freshAttemptId).not.toBe(staleAttemptId);

    state = reduceAppLockState(state, {
      type: 'prompt_resolved',
      attemptId: freshAttemptId,
      success: true,
    });
    expect(state.locked).toBe(false);
  });

  it('accepts device-credential success across prompt-driven background', () => {
    let state = createAppLockState(true, 'active');
    state = reduceAppLockState(state, { type: 'prompt_started', kind: 'automatic' });
    const attemptId = state.promptAttempt!.id;

    state = reduceAppLockState(state, { type: 'app_state_changed', lifecycle: 'background' });
    expect(state.locked).toBe(true);
    expect(state.promptAttempt?.id).toBe(attemptId);
    expect(shouldAutomaticallyPrompt(state)).toBe(false);

    state = reduceAppLockState(state, {
      type: 'prompt_resolved',
      attemptId,
      success: true,
    });
    expect(state.locked).toBe(true);
    expect(state.pendingAuthentication).toBe(true);

    state = reduceAppLockState(state, { type: 'app_state_changed', lifecycle: 'active' });
    expect(state.locked).toBe(false);
    expect(state.pendingAuthentication).toBe(false);
    expect(shouldAutomaticallyPrompt(state)).toBe(false);
  });

  it('accepts prompt success across biometric-driven inactivity without looping', () => {
    let state = createAppLockState(true, 'active');
    state = reduceAppLockState(state, { type: 'prompt_started', kind: 'automatic' });
    const attemptId = state.promptAttempt!.id;

    state = reduceAppLockState(state, { type: 'app_state_changed', lifecycle: 'inactive' });
    expect(state.locked).toBe(true);
    expect(state.promptAttempt?.id).toBe(attemptId);
    expect(shouldAutomaticallyPrompt(state)).toBe(false);

    state = reduceAppLockState(state, {
      type: 'prompt_resolved',
      attemptId,
      success: true,
    });
    expect(state.locked).toBe(true);
    expect(state.pendingAuthentication).toBe(true);

    state = reduceAppLockState(state, { type: 'app_state_changed', lifecycle: 'active' });
    expect(state.locked).toBe(false);
    expect(state.pendingAuthentication).toBe(false);
    expect(shouldAutomaticallyPrompt(state)).toBe(false);
  });

  it('invalidates an unresolved prompt when active resumes before its result', () => {
    let state = createAppLockState(true, 'active');
    state = reduceAppLockState(state, { type: 'prompt_started', kind: 'automatic' });
    const staleAttemptId = state.promptAttempt!.id;

    state = reduceAppLockState(state, { type: 'app_state_changed', lifecycle: 'inactive' });
    state = reduceAppLockState(state, { type: 'app_state_changed', lifecycle: 'active' });
    expect(state.promptAttempt).toBeNull();
    expect(state.locked).toBe(true);
    expect(shouldAutomaticallyPrompt(state)).toBe(true);

    const afterStaleSuccess = reduceAppLockState(state, {
      type: 'prompt_resolved',
      attemptId: staleAttemptId,
      success: true,
    });
    expect(afterStaleSuccess).toBe(state);
    expect(afterStaleSuccess.locked).toBe(true);
  });

  it('does not loop after a biometric prompt is cancelled while inactive', () => {
    let state = createAppLockState(true, 'active');
    state = reduceAppLockState(state, { type: 'prompt_started', kind: 'automatic' });
    const attemptId = state.promptAttempt!.id;

    state = reduceAppLockState(state, { type: 'app_state_changed', lifecycle: 'inactive' });
    state = reduceAppLockState(state, {
      type: 'prompt_resolved',
      attemptId,
      success: false,
    });
    state = reduceAppLockState(state, { type: 'app_state_changed', lifecycle: 'active' });

    expect(state.locked).toBe(true);
    expect(state.promptAttempt).toBeNull();
    expect(shouldAutomaticallyPrompt(state)).toBe(false);

    state = reduceAppLockState(state, { type: 'prompt_started', kind: 'manual' });
    expect(state.promptAttempt).not.toBeNull();
  });

  it('does not auto-prompt repeatedly after cancellation but permits a manual retry', () => {
    let state = createAppLockState(true, 'active');
    state = reduceAppLockState(state, { type: 'prompt_started', kind: 'automatic' });
    state = reduceAppLockState(state, {
      type: 'prompt_resolved',
      attemptId: state.promptAttempt!.id,
      success: false,
    });

    expect(state.locked).toBe(true);
    expect(shouldAutomaticallyPrompt(state)).toBe(false);

    state = reduceAppLockState(state, { type: 'prompt_started', kind: 'manual' });
    expect(state.promptAttempt).not.toBeNull();
  });

  it('invalidates authentication when the lock is disabled during a prompt', () => {
    let state = createAppLockState(true, 'active');
    state = reduceAppLockState(state, { type: 'prompt_started', kind: 'automatic' });
    const staleAttemptId = state.promptAttempt!.id;

    state = reduceAppLockState(state, { type: 'set_required', required: false });
    expect(state.promptAttempt).toBeNull();
    const afterStaleSuccess = reduceAppLockState(state, {
      type: 'prompt_resolved',
      attemptId: staleAttemptId,
      success: true,
    });
    expect(afterStaleSuccess).toBe(state);
    expect(state.required).toBe(false);
    expect(state.locked).toBe(false);

    state = reduceAppLockState(state, { type: 'set_required', required: true });
    expect(state.locked).toBe(true);
    expect(shouldAutomaticallyPrompt(state)).toBe(true);
  });
});

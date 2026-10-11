/** Bounded, process-local evidence from the workers themselves. No payload rows,
 * URLs, preferences or arbitrary exception text are retained here. */
export type BackgroundWorkOutcome = 'completed' | 'failed' | 'fallback' | 'superseded' | 'unavailable';
export interface BackgroundWorkStage {
  label: string;
  startedAt: string;
  durationMs: number;
  active: boolean;
}
export interface BackgroundWorkSnapshot {
  id: number;
  label: string;
  runDate: string | null;
  startedAt: string;
  finishedAt: string | null;
  elapsedMs: number;
  outcome: BackgroundWorkOutcome | null;
  stage: string;
  stageElapsedMs: number;
  stages: BackgroundWorkStage[];
  omittedStages: number;
}
export interface BackgroundWorkHandle {
  stage(label: string): void;
  finish(outcome?: BackgroundWorkOutcome): void;
}
type Work = {
  id: number; label: string; runDate: string | null; start: number; end: number | null;
  outcome: BackgroundWorkOutcome | null;
  stages: { label: string; start: number; end: number | null }[];
  omittedStages: number;
};
const MAX_COMPLETED = 32;
const MAX_ACTIVE = 32;
const MAX_STAGES = 32;
const bounded = (text: string) => text.slice(0, 160);

export class BackgroundPayloadWorkRegistry {
  private sequence = 0;
  private active = new Map<number, Work>();
  private completed: Work[] = [];
  private activeCount = 0;
  constructor(private clock: () => number = () => Date.now()) {}

  begin(label: string, runDate: string | null = null, stage = 'Starting'): BackgroundWorkHandle {
    const start = this.clock();
    const work: Work = { id: ++this.sequence, label: bounded(label),
      runDate: runDate?.slice(0, 128) ?? null, start, end: null, outcome: null,
      stages: [{ label: bounded(stage), start, end: null }], omittedStages: 0 };
    this.active.set(work.id, work);
    this.activeCount++;
    if (this.active.size > MAX_ACTIVE) this.active.delete(this.active.keys().next().value!);
    return {
      stage: label => {
        if (work.end !== null) return;
        const current = work.stages[work.stages.length - 1];
        if (current.label === bounded(label)) return;
        const now = this.clock();
        current.end = now;
        work.stages.push({ label: bounded(label), start: now, end: null });
        if (work.stages.length > MAX_STAGES) { work.stages.shift(); work.omittedStages++; }
      },
      finish: (outcome = 'completed') => {
        if (work.end !== null) return;
        work.end = this.clock();
        work.outcome = outcome;
        this.activeCount--;
        work.stages[work.stages.length - 1].end = work.end;
        this.active.delete(work.id);
        this.completed.push(work);
        if (this.completed.length > MAX_COMPLETED) this.completed.shift();
      },
    };
  }

  hasActiveWork(): boolean { return this.activeCount > 0; }
  omittedActiveJobs(): number { return this.activeCount - this.active.size; }

  /** Include work that began before observation but finished during it. */
  snapshot(since = 0): BackgroundWorkSnapshot[] {
    const now = this.clock();
    return [...this.completed.filter(work => work.end! >= since), ...this.active.values()].map(work => {
      const stage = work.stages[work.stages.length - 1];
      return { id: work.id, label: work.label, runDate: work.runDate,
        startedAt: new Date(work.start).toISOString(),
        finishedAt: work.end === null ? null : new Date(work.end).toISOString(),
        elapsedMs: Math.max(0, (work.end ?? now) - work.start), outcome: work.outcome,
        stage: stage.label, stageElapsedMs: Math.max(0, (stage.end ?? now) - stage.start),
        omittedStages: work.omittedStages,
        stages: work.stages.map(stage => ({ label: stage.label,
          startedAt: new Date(stage.start).toISOString(),
          durationMs: Math.max(0, (stage.end ?? now) - stage.start), active: stage.end === null })),
      };
    });
  }
}

export const backgroundPayloadWork = new BackgroundPayloadWorkRegistry();

import type { CorePayload, DetailsPayload, Manifest } from '../types';

export const sampleManifest: Manifest;
export const sampleCore: CorePayload;
export const SAMPLE_MAX_AGE_DAYS: number;
export function loadSampleDetails(): DetailsPayload;
export function sampleFallbackIsUsable(now?: Date): boolean;

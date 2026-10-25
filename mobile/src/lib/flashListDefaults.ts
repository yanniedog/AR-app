/**
 * Shared FlashList defaults tuned for audit/readiness and Hermes main-thread
 * budget. Keep drawDistance modest so offscreen logo/decode work stays bounded;
 * viewability thresholds match Rates so list readiness probes settle consistently.
 */
export const FLASH_LIST_DRAW_DISTANCE = 120;

export const FLASH_LIST_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 1,
  minimumViewTime: 16,
} as const;

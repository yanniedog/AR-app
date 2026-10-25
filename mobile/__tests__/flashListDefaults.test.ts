import {
  FLASH_LIST_DRAW_DISTANCE,
  FLASH_LIST_VIEWABILITY_CONFIG,
} from '../src/lib/flashListDefaults';

test('shared FlashList defaults stay audit-friendly and bounded', () => {
  expect(FLASH_LIST_DRAW_DISTANCE).toBe(120);
  expect(FLASH_LIST_VIEWABILITY_CONFIG.itemVisiblePercentThreshold).toBe(1);
  expect(FLASH_LIST_VIEWABILITY_CONFIG.minimumViewTime).toBe(16);
});

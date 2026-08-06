import { SECTIONS } from '../constants';
import type { SectionKey } from '../types';

let browseRequestSequence = 0;
const browseRequestSession = Date.now().toString(36);

/** Build a parameterized Browse entry with an identity that can be consumed once. */
export const buildBrowseRouteParams = (section: SectionKey, path: string[] = []) => ({
  section: SECTIONS[section].slug,
  request: `${browseRequestSession}-${++browseRequestSequence}`,
  ...(path.length ? { path: path.join('.') } : {}),
});

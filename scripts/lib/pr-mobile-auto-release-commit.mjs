/**
 * Paths and helpers for bot-authored mobile auto-release pull requests.
 */
import { ghJson } from './gh-pr-review-threads.mjs';

export const AUTO_RELEASE_BUMP_PREFIX = 'chore(mobile): auto-release bump to v';

const VERSION_JSON_RE = /^mobile\/changelog\/versions\/\d+\.\d+\.\d+\.json$/;

/**
 * @param {string} filePath
 * @returns {boolean}
 */
export function isAutoReleaseCommitPath(filePath) {
  const p = String(filePath || '').replace(/\\/g, '/');
  if (p === 'mobile/app.json') return true;
  if (p === 'mobile/changelog/manifest.json') return true;
  return VERSION_JSON_RE.test(p);
}

/**
 * @param {string[]} paths
 * @returns {boolean}
 */
export function isAutoReleaseCommitOnly(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return false;
  return paths.every((entry) => {
    const path = typeof entry === 'string' ? entry : entry?.path || '';
    return isAutoReleaseCommitPath(path);
  });
}

/**
 * @param {string} title
 * @returns {boolean}
 */
export function isAutoReleaseBumpTitle(title) {
  return String(title || '').trim().startsWith(AUTO_RELEASE_BUMP_PREFIX);
}

/**
 * @param {number|string} prNumber
 * @returns {boolean}
 */
export function isAutoReleaseOnlyPr(prNumber) {
  const view = ghJson(['pr', 'view', String(prNumber), '--json', 'title,files']);
  const title = String(view?.title || '').trim();
  if (!isAutoReleaseBumpTitle(title)) return false;
  const paths = (Array.isArray(view?.files) ? view.files : []).map((f) => f.path);
  // Title matches - exempt when GitHub has not listed files yet (pull_request opened race).
  if (paths.length === 0) return true;
  return isAutoReleaseCommitOnly(paths);
}

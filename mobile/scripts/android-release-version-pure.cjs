function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim());
  if (!match) {
    throw new Error(`Expected an x.y.z app version, received "${version}"`);
  }
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] > b[index] ? 1 : -1;
    }
  }
  return 0;
}

function bumpPatch(version) {
  const [major, minor, patch] = parseVersion(version);
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * The checked-in version is an intentional release floor. Once an APK has
 * shipped at that version (or newer), advance the published patch iteration.
 */
function nextReleaseVersion(currentVersion, remoteVersion) {
  parseVersion(currentVersion);
  if (remoteVersion == null || String(remoteVersion).trim() === '') {
    return currentVersion;
  }
  const publishedVersion = String(remoteVersion).trim();
  return compareVersions(currentVersion, publishedVersion) > 0
    ? currentVersion
    : bumpPatch(publishedVersion);
}

function nextVersionCode(current, remote, runFloor = 0) {
  const currentCode = Number(current) || 1;
  const remoteCode = remote == null ? null : Number(remote);
  const workflowFloor = Number(runFloor) || 0;
  return remoteCode != null && Number.isFinite(remoteCode)
    ? Math.max(remoteCode + 1, currentCode, workflowFloor)
    : Math.max(currentCode, workflowFloor);
}

/** Combine channel manifests without allowing either version or versionCode to move backwards. */
function mergeReleaseFloors(remotes) {
  const valid = (remotes || []).filter(Boolean);
  if (!valid.length) return null;
  return {
    version: valid.reduce(
      (latest, item) =>
        compareVersions(String(item.version), String(latest)) > 0 ? String(item.version) : latest,
      String(valid[0].version),
    ),
    buildNumber: Math.max(...valid.map((item) => Number(item.buildNumber))),
  };
}

module.exports = {
  compareVersions,
  mergeReleaseFloors,
  nextReleaseVersion,
  nextVersionCode,
};

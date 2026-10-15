# Android emulator validation artifact

The `Android emulator validation artifact` workflow builds a release-mode x86_64 APK for isolated Android emulation without DevLauncher or Metro. It runs manually, or for same-repository pull requests that include a change to its sole trigger path, `.github/workflows/android-emulator-validation.yml`. Pull-request builds check out the exact head SHA, not GitHub's merge ref. Superseded builds for that PR are cancelled.

This is an artifact-only build, not an emulator test or public release. Existing required CI, branch protection, release workflows and queue batching remain unchanged. There is no schedule, release environment, production key, secret, deployment or publication step. The build omits optional development tooling, uses the checked-in Firebase placeholders and retains the standard release R8/resource-shrinking configuration.

The three-day Actions artifact contains `validation.apk`, `metadata.json`, `apk.sha256`, `source-sha.txt`, `badging.txt`, `manifest.txt` and `signature.txt`. The build checks the actual package/version, exactly x86_64 ABI, APK signature and immutable checked-out source, then records the actual bytes, SHA-256 and signer fingerprint. Signature validity does not establish the production signing identity; no release signing key is supplied. The generated test signing configuration is intended only for an isolated emulator.

Before using an artifact, review its workflow run/source association and verify the downloaded APK against `metadata.json` and `apk.sha256`. Preserve the installed-package/ABI/hash readback with each native capture. An operator must separately execute and assess Back, keyboard input, task/state restoration, accessibility and the approved Android matrix. A successful build or signature receipt proves none of those interactions.

Validation artifacts retain the source version/build fields and are not the public update channel. Public manifest/hash/signing verification, final public-byte installation and physical-device acceptance remain separate release-closeout evidence.

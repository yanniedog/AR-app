# #0008 APK workflow publishes releases but then fails because README fallback uses GITHUB_TOKEN while Actions PR creation is disabled.

- 2026-07-23T07:39:33Z `issue`: APK workflow publishes releases but then fails because README fallback uses GITHUB_TOKEN while Actions PR creation is disabled. [.github/workflows/mobile-android-apk.yml]
- 2026-07-23T11:56:49Z `attempt`: Recovered the workflow-generated chore/readme-apk-qr-v1.0.43-b156 branch by manually opening PR #27, adding the established mobile README CI marker, clearing review gates, and squash-merging with [skip ci]. (worked)
- 2026-07-23T11:56:54Z `fix`: README publication recovered through PR #27; main now shows v1.0.43/build 156, and [skip ci] prevented a duplicate APK build. [README.md]

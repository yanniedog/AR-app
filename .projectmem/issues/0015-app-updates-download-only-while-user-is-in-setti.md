# #0015 App updates download only while user is in Settings and stop when backgrounded/screen off; need automatic background APK download then install-from-cache on upgrade prompt

- 2026-07-27T23:30:10Z `issue`: App updates download only while user is in Settings and stop when backgrounded/screen off; need automatic background APK download then install-from-cache on upgrade prompt [mobile/src/lib/appUpdate.ts]
- 2026-07-27T23:33:47Z `attempt`: Wire background APK download on update check, Upgrade alert/banner/settings install-from-cache, jest mocks + download logic tests [mobile/src/lib/appUpdateDownload.ts] (worked)
- 2026-07-27T23:34:04Z `fix`: App updates now auto-download in the background via DownloadManager and Upgrade installs the cached APK; verified with typecheck + focused Jest suites [mobile/src/lib/appUpdateDownload.ts]

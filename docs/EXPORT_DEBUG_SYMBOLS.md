# Runtime bundles and private debug symbols

Expo exports use `--source-maps`. Hermes then moves debugging tables out of the runtime bytecode into a separate map, matching React Native Gradle's existing default `-O -output-source-map` compilation. This reduces delivered bytecode without changing calculation logic or increasing the existing 5% size budgets.

After export, `separate-export-symbols.mjs` validates each known `.hbc.map` / `.js.map` against its sibling runtime file, copies it into ignored `mobile/.expo/export-symbols/<sha256>/`, verifies the copy, writes a runtime/hash-bound manifest, then removes the original map from `dist`. Unknown map names, malformed maps, or missing bytecode fail export. Symbols remain local; no release or public upload step is added. Preserve that private directory when retaining a build for diagnosis. The manifest describes the latest export; content-addressed older maps remain available.

The size report measures private debug symbols separately and verifies their exact runtime identity. All files remaining in each runtime platform directory still count against its unchanged budget, including unrecognized extensions. There is no blanket map exclusion from size accounting.

Native Gradle independently writes symbols under `generated/sourcemaps/react/<variant>` and registers only `generated/assets/react/<variant>` as bundle assets. Expo's `dist` and `.expo/export-symbols` are not Gradle asset inputs. APK publication explicitly selects the APK and release metadata, rather than exporting either symbol directory. This change does not prove a rebuilt or installed APK; native acceptance remains separate.

The savings diagnostic checks exact shared tier allocation, daily interest and generic missing-fact evaluation. It does not establish full native assessment-window or real-bank eligibility coverage.

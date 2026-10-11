const { withAndroidManifest } = require('expo/config-plugins');

/** Android 11+ hides browser handlers from canOpenURL without this query. */
function addExternalLinkQueries(manifest) {
  const queries = manifest.queries ?? (manifest.queries = []);
  const exists = queries.some((group) => (group.intent ?? []).some((intent) =>
    (intent.action ?? []).some((action) => action.$?.['android:name'] === 'android.intent.action.VIEW')
    && (intent.data ?? []).some((data) => data.$?.['android:scheme'] === 'https'),
  ));
  if (!exists) {
    const group = queries[0] ?? {};
    if (!queries.length) queries.push(group);
    (group.intent ?? (group.intent = [])).push({
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: [{ $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
      data: [{ $: { 'android:scheme': 'https' } }],
    });
  }
  return manifest;
}

module.exports = (config) => withAndroidManifest(config, (result) => {
  addExternalLinkQueries(result.modResults.manifest);
  return result;
});
module.exports.addExternalLinkQueries = addExternalLinkQueries;

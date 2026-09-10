const { withAndroidManifest } = require('@expo/config-plugins');

// Google Play flags READ_MEDIA_IMAGES / READ_MEDIA_VIDEO on Android 13+
// unless a system photo/video picker is used. We only use
// expo-document-picker's Storage Access Framework picker (no runtime
// permission needed at all), but some native dependency's manifest still
// merges in READ_EXTERNAL_STORAGE/WRITE_EXTERNAL_STORAGE, which the Android
// Gradle manifest merger then auto-upgrades into READ_MEDIA_IMAGES/VIDEO for
// apps targeting API 33+. Explicitly cancel all four so they never reach
// the final merged manifest, regardless of which dependency added them.
const REMOVE_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
];

function withNoMediaPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';

    if (!manifest['uses-permission']) manifest['uses-permission'] = [];

    manifest['uses-permission'] = manifest['uses-permission'].filter(
      (perm) => !REMOVE_PERMISSIONS.includes(perm.$['android:name'])
    );

    for (const name of REMOVE_PERMISSIONS) {
      manifest['uses-permission'].push({
        $: { 'android:name': name, 'tools:node': 'remove' },
      });
    }

    return config;
  });
}

module.exports = withNoMediaPermissions;

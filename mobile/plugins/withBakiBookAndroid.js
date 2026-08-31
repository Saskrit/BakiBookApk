const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');

const DEFAULT_DEVELOPER = 'Saskrit Bhattarai';
const DEVELOPER_META_NAME = 'com.bakibook.app.DEVELOPER';

const BAKIBOOK_META_XML = (developer) => `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="developer_name">${developer}</string>
</resources>
`;

const MARKER = 'BakiBook: friendly APK filename';
const SNIPPET = `
// ${MARKER}
android.applicationVariants.configureEach { variant ->
    variant.outputs.configureEach { output ->
        def suffix = variant.buildType.name == "release" ? "" : "-\${variant.buildType.name}"
        output.outputFileName = "BakiBook\${suffix}.apk"
    }
}
`;

/** Copy designer Android launcher pack into native res/ after prebuild. */
function withBakiBookLauncherIcons(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const { syncAndroidIcons } = require(path.join(projectRoot, 'scripts', 'sync-android-icons.js'));
      const result = await syncAndroidIcons(projectRoot);
      if (!result.skipped) {
        console.log(
          `[withBakiBookAndroid] Synced ${result.copied} launcher + ${result.splash} splash icon(s)` +
            (result.removed ? `, removed ${result.removed} stale .webp` : '')
        );
      }
      return cfg;
    },
  ]);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeIfChanged(filePath, contents) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === contents) {
    return;
  }
  fs.writeFileSync(filePath, contents, 'utf8');
}

function withBakiBookDeveloperMeta(config) {
  const developer = config.extra?.developer?.trim() || DEFAULT_DEVELOPER;

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const valuesDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'values'
      );
      ensureDir(valuesDir);
      writeIfChanged(path.join(valuesDir, 'bakibook_meta.xml'), BAKIBOOK_META_XML(developer));
      return cfg;
    },
  ]);

  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    if (!app['meta-data']) {
      app['meta-data'] = [];
    }
    app['meta-data'] = app['meta-data'].filter(
      (entry) => entry.$['android:name'] !== DEVELOPER_META_NAME
    );
    app['meta-data'].push({
      $: {
        'android:name': DEVELOPER_META_NAME,
        'android:value': '@string/developer_name',
      },
    });
    return cfg;
  });
}

/** @param {import('@expo/config-plugins').ExpoConfig} config */
module.exports = function withBakiBookAndroid(config) {
  config = withBakiBookLauncherIcons(config);
  config = withBakiBookDeveloperMeta(config);
  config = withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.ensurePermission(
      cfg.modResults,
      'android.permission.POST_NOTIFICATIONS'
    );
    AndroidConfig.Permissions.ensurePermission(cfg.modResults, 'android.permission.VIBRATE');
    return cfg;
  });
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /^dependencies \{/m,
        `${SNIPPET}\ndependencies {`
      );
    }
    return cfg;
  });
};

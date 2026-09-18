/**
 * Wire Firebase for Expo Android (buildscript / apply-plugin style).
 * - Copies google-services.json into android/app/
 * - Adds Google services classpath to root build.gradle
 * - Applies plugin + Firebase BoM (analytics + messaging) on app/build.gradle
 */
const fs = require('fs');
const path = require('path');
const {
  withProjectBuildGradle,
  withAppBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');

const GOOGLE_SERVICES_CLASSPATH =
  "classpath('com.google.gms:google-services:4.5.0')";
const GOOGLE_SERVICES_APPLY = 'apply plugin: "com.google.gms.google-services"';
const FIREBASE_DEPS_MARKER = 'BakiBook: Firebase BoM';
const FIREBASE_DEPS = `
    // ${FIREBASE_DEPS_MARKER}
    implementation platform('com.google.firebase:firebase-bom:34.19.0')
    implementation 'com.google.firebase:firebase-analytics'
    implementation 'com.google.firebase:firebase-messaging'
`;

function copyGoogleServicesJson(projectRoot, platformProjectRoot) {
  const candidates = [
    path.join(projectRoot, 'google-services.json'),
    path.join(projectRoot, 'android', 'app', 'google-services.json'),
  ];
  const src = candidates.find((p) => fs.existsSync(p));
  if (!src) {
    console.warn(
      '[withBakiBookFirebase] Missing google-services.json — place it at mobile/google-services.json'
    );
    return false;
  }
  const destDir = path.join(platformProjectRoot, 'app');
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, 'google-services.json');
  fs.copyFileSync(src, dest);
  console.log(`[withBakiBookFirebase] Copied google-services.json -> ${dest}`);
  return true;
}

function withGoogleServicesFile(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      copyGoogleServicesJson(cfg.modRequest.projectRoot, cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);
}

function withRootGoogleServicesClasspath(config) {
  return withProjectBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes('com.google.gms:google-services')) {
      return cfg;
    }

    if (/buildscript\s*\{[\s\S]*?dependencies\s*\{/.test(contents)) {
      contents = contents.replace(
        /(buildscript\s*\{[\s\S]*?dependencies\s*\{)/,
        `$1\n    ${GOOGLE_SERVICES_CLASSPATH}`
      );
    } else if (/plugins\s*\{/.test(contents)) {
      contents = contents.replace(
        /plugins\s*\{/,
        `plugins {\n  id 'com.google.gms.google-services' version '4.5.0' apply false`
      );
    } else {
      console.warn('[withBakiBookFirebase] Could not inject google-services classpath');
      return cfg;
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

function withAppFirebase(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (!contents.includes(FIREBASE_DEPS_MARKER)) {
      if (/^dependencies\s*\{/m.test(contents)) {
        contents = contents.replace(/^dependencies\s*\{/m, `dependencies {${FIREBASE_DEPS}`);
      } else {
        contents += `\ndependencies {${FIREBASE_DEPS}}\n`;
      }
    }

    if (!contents.includes('com.google.gms.google-services')) {
      contents = `${contents.trimEnd()}\n\n${GOOGLE_SERVICES_APPLY}\n`;
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

/** @param {import('@expo/config-plugins').ExpoConfig} config */
module.exports = function withBakiBookFirebase(config) {
  config = withGoogleServicesFile(config);
  config = withRootGoogleServicesClasspath(config);
  config = withAppFirebase(config);
  return config;
};

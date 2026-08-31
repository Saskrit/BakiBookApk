/**
 * Sync designer launcher pack + current logo into native android/res
 * so install / home-screen icons never keep stale Expo .webp or old splash logos.
 */
const fs = require('fs');
const path = require('path');
const { generateImageAsync } = require('@expo/image-utils');

const MIPMAP_DIRS = [
  'mipmap-anydpi-v26',
  'mipmap-ldpi',
  'mipmap-mdpi',
  'mipmap-hdpi',
  'mipmap-xhdpi',
  'mipmap-xxhdpi',
  'mipmap-xxxhdpi',
];

/** Splash logo pixel sizes used by Expo Android templates. */
const SPLASH_SIZES = [
  { dir: 'drawable-mdpi', size: 200 },
  { dir: 'drawable-hdpi', size: 300 },
  { dir: 'drawable-xhdpi', size: 400 },
  { dir: 'drawable-xxhdpi', size: 600 },
  { dir: 'drawable-xxxhdpi', size: 800 },
];

const LAUNCHER_PATTERN = /^ic_launcher/i;

function copyDirContents(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return 0;
  fs.mkdirSync(destDir, { recursive: true });
  let count = 0;
  for (const name of fs.readdirSync(srcDir)) {
    const from = path.join(srcDir, name);
    const to = path.join(destDir, name);
    if (fs.statSync(from).isDirectory()) {
      count += copyDirContents(from, to);
    } else {
      fs.copyFileSync(from, to);
      count += 1;
    }
  }
  return count;
}

/** Remove Expo-generated ic_launcher*.webp so designer PNGs always win. */
function removeExpoLauncherWebp(resRoot) {
  let removed = 0;
  if (!fs.existsSync(resRoot)) return removed;

  for (const entry of fs.readdirSync(resRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('mipmap-')) continue;
    const dir = path.join(resRoot, entry.name);
    for (const file of fs.readdirSync(dir)) {
      if (!LAUNCHER_PATTERN.test(file)) continue;
      if (!/\.webp$/i.test(file)) continue;
      fs.unlinkSync(path.join(dir, file));
      removed += 1;
    }
  }

  return removed;
}

function resolveLogoSource(projectRoot) {
  const candidates = [
    path.join(projectRoot, 'assets', 'logo.png'),
    path.join(projectRoot, 'assets', 'splash-icon.png'),
    path.join(projectRoot, 'assets', 'icon.png'),
    path.join(projectRoot, 'assets', 'android', 'playstore-icon.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function syncSplashLogos(projectRoot, resRoot) {
  const src = resolveLogoSource(projectRoot);
  if (!src) return 0;

  let written = 0;
  for (const { dir, size } of SPLASH_SIZES) {
    const outDir = path.join(resRoot, dir);
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'splashscreen_logo.png');

    const { source: generated } = await generateImageAsync(
      { projectRoot, cacheType: 'bakibook-splash' },
      {
        src,
        name: `splashscreen_logo_${size}`,
        width: size,
        height: size,
        resizeMode: 'contain',
        backgroundColor: '#FAFAFA',
      }
    );

    fs.writeFileSync(outPath, generated);
    written += 1;
  }
  return written;
}

/**
 * @param {string} projectRoot mobile/ directory
 * @returns {Promise<{ copied: number, removed: number, splash: number, skipped: boolean }>}
 */
async function syncAndroidIcons(projectRoot) {
  const root = path.resolve(projectRoot);
  const srcRoot = path.join(root, 'assets', 'android');
  const resRoot = path.join(root, 'android', 'app', 'src', 'main', 'res');

  if (!fs.existsSync(path.join(root, 'android'))) {
    return { copied: 0, removed: 0, splash: 0, skipped: true };
  }

  const removed = removeExpoLauncherWebp(resRoot);

  let copied = 0;
  if (fs.existsSync(srcRoot)) {
    for (const dir of MIPMAP_DIRS) {
      copied += copyDirContents(path.join(srcRoot, dir), path.join(resRoot, dir));
    }

    const bgSrc = path.join(srcRoot, 'values', 'ic_launcher_background.xml');
    if (fs.existsSync(bgSrc)) {
      const valuesDir = path.join(resRoot, 'values');
      fs.mkdirSync(valuesDir, { recursive: true });
      fs.copyFileSync(bgSrc, path.join(valuesDir, 'ic_launcher_background.xml'));
      copied += 1;
    }
  }

  // Remove any webp Expo may have left after PNG copy
  const removedAfter = removeExpoLauncherWebp(resRoot);
  const splash = await syncSplashLogos(root, resRoot);

  return {
    copied,
    removed: removed + removedAfter,
    splash,
    skipped: false,
  };
}

module.exports = { syncAndroidIcons, removeExpoLauncherWebp };

if (require.main === module) {
  const projectRoot = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, '..');
  syncAndroidIcons(projectRoot)
    .then((result) => {
      if (result.skipped) {
        console.log('android/ not found — run expo prebuild first; skipping icon sync.');
        process.exit(0);
      }
      const dest = path.join(projectRoot, 'android/app/src/main/res');
      console.log(
        `Synced ${result.copied} launcher file(s), ${result.splash} splash logo(s) -> ${dest}` +
          (result.removed ? ` (removed ${result.removed} stale .webp)` : '')
      );
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}

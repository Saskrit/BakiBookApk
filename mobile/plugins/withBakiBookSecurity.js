const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');

const NETWORK_CONFIG_RELEASE = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

const NETWORK_CONFIG_DEBUG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">localhost</domain>
    <domain includeSubdomains="true">10.0.2.2</domain>
    <domain includeSubdomains="true">127.0.0.1</domain>
  </domain-config>
</network-security-config>
`;

const SECURE_FILE_PATHS = `<?xml version="1.0" encoding="utf-8"?>
<paths>
  <cache-path name="cache" path="." />
  <files-path name="files" path="." />
  <external-cache-path name="external_cache" path="." />
  <external-files-path name="external_files" path="." />
</paths>
`;

const FILE_PROVIDER_OVERRIDES = [
  {
    name: 'expo.modules.filesystem.FileSystemFileProvider',
    authoritySuffix: 'FileSystemFileProvider',
  },
  {
    name: 'expo.modules.imagepicker.fileprovider.ImagePickerFileProvider',
    authoritySuffix: 'ImagePickerFileProvider',
  },
];

const FILE_PROVIDER_PATHS_NAMES = [
  'android.support.FILE_PROVIDER_PATHS',
  'androidx.core.content.FILE_PROVIDER_PATHS',
];

function ensureMetaDataList(provider) {
  if (!provider['meta-data']) {
    provider['meta-data'] = [];
  } else if (!Array.isArray(provider['meta-data'])) {
    provider['meta-data'] = [provider['meta-data']];
  }
  return provider['meta-data'];
}

function upsertFileProviderOverrides(app, applicationId) {
  if (!app.provider) {
    app.provider = [];
  }

  for (const override of FILE_PROVIDER_OVERRIDES) {
    let provider = app.provider.find((item) => item.$['android:name'] === override.name);

    if (!provider) {
      provider = {
        $: {
          'android:name': override.name,
          'android:authorities': `${applicationId}.${override.authoritySuffix}`,
          'android:exported': 'false',
          'android:grantUriPermissions': 'true',
        },
        'meta-data': [],
      };
      app.provider.push(provider);
    }

    // Older plugin versions wrongly set android:resource on the provider itself.
    delete provider.$['android:resource'];
    if (provider.$['tools:replace'] === 'android:resource') {
      delete provider.$['tools:replace'];
    }

    provider.$['android:exported'] = 'false';
    provider.$['android:grantUriPermissions'] = 'true';
    if (!provider.$['android:authorities']) {
      provider.$['android:authorities'] = `${applicationId}.${override.authoritySuffix}`;
    }

    const metaList = ensureMetaDataList(provider);
    let pathsMeta = metaList.find((meta) =>
      FILE_PROVIDER_PATHS_NAMES.includes(meta?.$?.['android:name'])
    );

    if (!pathsMeta) {
      pathsMeta = {
        $: {
          'android:name': 'android.support.FILE_PROVIDER_PATHS',
          'android:resource': '@xml/bakibook_secure_file_paths',
          'tools:replace': 'android:resource',
        },
      };
      metaList.push(pathsMeta);
    } else {
      pathsMeta.$['android:resource'] = '@xml/bakibook_secure_file_paths';
      pathsMeta.$['tools:replace'] = 'android:resource';
    }
  }
}

/** @param {import('@expo/config-plugins').AndroidManifest.AndroidManifest} manifest */
function hardenApplication(manifest, applicationId) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  app.$['android:allowBackup'] = 'false';
  app.$['android:usesCleartextTraffic'] = 'false';
  app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
  app.$['android:hasFragileUserData'] = 'true';

  const activities = app.activity ?? [];
  for (const activity of activities) {
    if (activity.$['android:name']?.includes('MainActivity')) {
      activity.$['android:taskAffinity'] = '';
      activity.$['android:allowTaskReparenting'] = 'false';
      if (!activity.$['android:launchMode']) {
        activity.$['android:launchMode'] = 'singleTask';
      }
    }
  }

  upsertFileProviderOverrides(app, applicationId);
  return manifest;
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

function withBakiBookSecurityResources(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const platformRoot = cfg.modRequest.platformProjectRoot;
      const mainXml = path.join(platformRoot, 'app', 'src', 'main', 'res', 'xml');
      const debugXml = path.join(platformRoot, 'app', 'src', 'debug', 'res', 'xml');

      ensureDir(mainXml);
      ensureDir(debugXml);

      writeIfChanged(path.join(mainXml, 'network_security_config.xml'), NETWORK_CONFIG_RELEASE);
      writeIfChanged(path.join(debugXml, 'network_security_config.xml'), NETWORK_CONFIG_DEBUG);
      writeIfChanged(path.join(mainXml, 'bakibook_secure_file_paths.xml'), SECURE_FILE_PATHS);

      return cfg;
    },
  ]);
}

/** @param {import('@expo/config-plugins').ExpoConfig} config */
module.exports = function withBakiBookSecurity(config) {
  config = withBakiBookSecurityResources(config);
  return withAndroidManifest(config, (cfg) => {
    const applicationId =
      cfg.android?.package || AndroidConfig.Package.getApplicationId(cfg) || 'com.bakibook.app';
    cfg.modResults = hardenApplication(cfg.modResults, applicationId);
    return cfg;
  });
};

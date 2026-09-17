# Build a signed release Android App Bundle (.aab) locally for Google Play Store.
# Usage: .\scripts\build-aab-local.ps1
# Output: dist\BakiBook.aab (ready for Google Play Console upload)

$ErrorActionPreference = 'Stop'
$mobileRoot = (Resolve-Path (Split-Path -Parent $PSScriptRoot)).Path

function Resolve-JdkHome {
  param([string[]]$Candidates)
  foreach ($candidate in $Candidates) {
    if (-not $candidate) { continue }
    if ($candidate -match '[*?]') { continue }
    $javaExe = Join-Path $candidate 'bin\java.exe'
    if (Test-Path $javaExe) { return $candidate }
  }
  return $null
}

function Get-JdkMajorVersion {
  param([string]$JdkHome)
  if (-not $JdkHome) { return 0 }
  if ($JdkHome -match 'jdk-(\d+)') { return [int]$Matches[1] }
  if ($JdkHome -match '[/\\](\d+)(?:[\.\\-]|$)') { return [int]$Matches[1] }

  $javaExe = Join-Path $JdkHome 'bin\java.exe'
  if (-not (Test-Path $javaExe)) { return 0 }
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $out = (& $javaExe -version 2>&1 | ForEach-Object { "$_" }) -join "`n"
  } finally {
    $ErrorActionPreference = $prev
  }
  if ($out -match 'version "(\d+)') { return [int]$Matches[1] }
  return 0
}

function Find-InstalledJdkHome {
  $roots = @(
    'C:\bk\jdk'
    (Join-Path $env:ProgramFiles 'Microsoft')
    (Join-Path $env:ProgramFiles 'Eclipse Adoptium')
    (Join-Path $env:ProgramFiles 'Java')
    (Join-Path $env:ProgramFiles 'Android\Android Studio\jbr')
    (Join-Path ${env:ProgramFiles(x86)} 'Android\Android Studio\jbr')
    (Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr')
  )

  $found = @()
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    if (Test-Path (Join-Path $root 'bin\java.exe')) {
      $found += $root
      continue
    }
    Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match '^(jdk|jre|temurin|microsoft)' -or $_.Name -match '^jdk-' } |
      ForEach-Object {
        if (Test-Path (Join-Path $_.FullName 'bin\java.exe')) {
          $found += $_.FullName
        }
      }
  }

  if ($found.Count -eq 0) { return $null }

  $prefer = $found | Where-Object { $_ -match 'jdk-17|(^|[/\\])17([.\-]|$)' } | Select-Object -First 1
  if ($prefer) { return $prefer }
  $prefer = $found | Where-Object { $_ -match 'jdk-21|(^|[/\\])21([.\-]|$)' } | Select-Object -First 1
  if ($prefer) { return $prefer }

  foreach ($candidate in ($found | Sort-Object -Descending)) {
    $major = Get-JdkMajorVersion $candidate
    if ($major -ge 17 -and $major -le 21) { return $candidate }
  }
  return $null
}

function Sync-ShortMirror {
  param([string]$Source, [string]$Mirror)
  Write-Host "Syncing latest sources -> $Mirror"
  if (-not (Test-Path $Mirror)) {
    New-Item -ItemType Directory -Path $Mirror -Force | Out-Null
  }
  & robocopy $Source $Mirror /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NC /NS /NP `
    /XD node_modules .git dist .expo `
    'android\app\build' 'android\app\.cxx' 'android\.gradle' 'android\build' `
    /XF '*.apk' '*.aab' | Out-Null
  if ($LASTEXITCODE -ge 8) {
    throw "Failed syncing project to $Mirror (robocopy exit $LASTEXITCODE)"
  }
  $script:LASTEXITCODE = 0

  $srcModules = Join-Path $Source 'node_modules'
  $mirModules = Join-Path $Mirror 'node_modules'
  if (-not (Test-Path (Join-Path $srcModules 'expo-font'))) {
    throw "node_modules missing in $Source. Run npm install in mobile/ first."
  }

  $needsLink = $true
  if (Test-Path $mirModules) {
    $item = Get-Item $mirModules -Force
    $isLink = [bool]($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
    if ($isLink -and (Test-Path (Join-Path $mirModules 'expo-font'))) {
      $needsLink = $false
      Write-Host 'Mirror node_modules already linked to project'
    } elseif ($isLink) {
      cmd /c "rmdir `"$mirModules`"" | Out-Null
    } else {
      Write-Host 'Removing stale mirror node_modules...'
      cmd /c "rd /s /q `"$mirModules`"" | Out-Null
    }
  }

  if ($needsLink) {
    Write-Host "Linking node_modules -> $srcModules"
    cmd /c "mklink /J `"$mirModules`" `"$srcModules`"" | Out-Null
    if (-not (Test-Path (Join-Path $mirModules 'expo-font'))) {
      throw "Failed to link node_modules for $Mirror"
    }
  }
}

function Get-ShortMobileRoot {
  param([string]$Path)
  $mirror = 'C:\bk\mobile'
  if ((Test-Path $mirror) -or $Path.Length -gt 90 -or $Path -match 'OneDrive') {
    Sync-ShortMirror -Source $Path -Mirror $mirror
    Write-Host "Using short mirror $mirror"
    return $mirror
  }
  foreach ($letter in @('B', 'K', 'M', 'Z')) {
    $drive = "${letter}:"
    $existing = cmd /c "subst" 2>$null | Select-String "^\s*$([regex]::Escape($drive))"
    if ($existing) {
      if ($existing -match [regex]::Escape($Path)) {
        return "${drive}\"
      }
      cmd /c "subst $drive /d" 2>$null | Out-Null
    }
    cmd /c "subst $drive `"$Path`"" | Out-Null
    if ($LASTEXITCODE -eq 0) {
      return "${drive}\"
    }
  }
  return $Path
}

function Ensure-ReleaseKeystore {
  param([string]$KeystorePath, [string]$JdkHome)
  if (Test-Path $KeystorePath) {
    Write-Host "Using existing release keystore: $KeystorePath"
    return
  }

  $keystoreDir = Split-Path -Parent $KeystorePath
  if (-not (Test-Path $keystoreDir)) {
    New-Item -ItemType Directory -Path $keystoreDir -Force | Out-Null
  }

  $keytool = Join-Path $JdkHome 'bin\keytool.exe'
  if (-not (Test-Path $keytool)) {
    $keytool = 'keytool'
  }

  Write-Host "Generating local Google Play release keystore at: $KeystorePath"
  & $keytool -genkeypair -v -storetype PKCS12 -keystore $KeystorePath `
    -alias bakibook -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass 'bakibook2026' -keypass 'bakibook2026' `
    -dname 'CN=BakiBook, OU=Mobile, O=BakiBook, L=Kathmandu, ST=Bagmati, C=NP'

  if ($LASTEXITCODE -ne 0) {
    throw 'Failed to generate release keystore with keytool.'
  }
  Write-Host 'Release keystore generated successfully.' -ForegroundColor Green
}

$jdk = Resolve-JdkHome @(
  $env:JAVA_HOME
  [Environment]::GetEnvironmentVariable('JAVA_HOME', 'User')
  [Environment]::GetEnvironmentVariable('JAVA_HOME', 'Machine')
  'C:\Program Files\Android\Android Studio\jbr'
  "${env:ProgramFiles(x86)}\Android\Android Studio\jbr"
  (Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr')
)

$discovered = Find-InstalledJdkHome
if ($discovered) {
  if (-not $jdk) {
    $jdk = $discovered
  } else {
    $major = Get-JdkMajorVersion $jdk
    if ($major -lt 17 -or $major -gt 21) {
      Write-Host "Ignoring JAVA_HOME=$jdk (Java $major). Using $discovered for Android builds."
      $jdk = $discovered
    }
  }
}

if (-not $jdk) {
  Write-Error 'JDK 17 not found. Install Microsoft OpenJDK 17: winget install --id Microsoft.OpenJDK.17 -e'
}

Write-Host "Using JAVA_HOME=$jdk (Java $(Get-JdkMajorVersion $jdk))"

$sdk = if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
  $env:ANDROID_HOME
} else {
  Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}

$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:NODE_ENV = 'production'
$env:GRADLE_USER_HOME = 'C:\bk-gradle'
if (-not (Test-Path $env:GRADLE_USER_HOME)) {
  New-Item -ItemType Directory -Path $env:GRADLE_USER_HOME -Force | Out-Null
}
$env:Path = "$jdk\bin;$sdk\platform-tools;" + $env:Path

# Ensure release keystore exists
$keystorePath = Join-Path $mobileRoot 'credentials\bakibook-release.keystore'
Ensure-ReleaseKeystore -KeystorePath $keystorePath -JdkHome $jdk

$prodApi = if ($env:BAKIBOOK_API_URL) {
  $env:BAKIBOOK_API_URL.Trim()
} else {
  'https://api.bakibook.run.place/api'
}
$prodGoogleWeb = '129286948746-c38ufv6he052pbr9c9l9a0upvr58e5fr.apps.googleusercontent.com'
$envFile = Join-Path $mobileRoot '.env'
$envBackup = Join-Path $mobileRoot '.env.bakibook-aab-backup'
$restoredEnv = $false

function Restore-MobileEnv {
  if ($restoredEnv) { return }
  if (Test-Path $envBackup) {
    Copy-Item -Path $envBackup -Destination $envFile -Force
    Remove-Item -Path $envBackup -Force -ErrorAction SilentlyContinue
  }
  $script:restoredEnv = $true
}

function Write-ReleaseEnv {
  param([string]$Path)
  @(
    '# Temporary values for release AAB build (restored after build)'
    "EXPO_PUBLIC_API_URL=$prodApi"
    "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=$prodGoogleWeb"
  ) | Set-Content -Path $Path -Encoding ascii
}

if (Test-Path $envFile) {
  Copy-Item -Path $envFile -Destination $envBackup -Force
}
Write-ReleaseEnv -Path $envFile
$env:EXPO_PUBLIC_API_URL = $prodApi
$env:EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = $prodGoogleWeb

$workRoot = Get-ShortMobileRoot -Path $mobileRoot
Write-Host "Working directory=$workRoot"
Write-ReleaseEnv -Path (Join-Path $workRoot '.env')

# Copy keystore to mirror
$mirrorCreds = Join-Path $workRoot 'credentials'
if (-not (Test-Path $mirrorCreds)) {
  New-Item -ItemType Directory -Path $mirrorCreds -Force | Out-Null
}
$mirrorKeystore = Join-Path $mirrorCreds 'bakibook-release.keystore'
Copy-Item -Path $keystorePath -Destination $mirrorKeystore -Force

# Always copy the latest google-services.json to workRoot
Copy-Item -Path (Join-Path $mobileRoot 'google-services.json') -Destination (Join-Path $workRoot 'google-services.json') -Force

# Read versionCode from app.config.ts
$versionCode = 7
if ((Get-Content (Join-Path $mobileRoot 'app.config.ts') -Raw) -match 'versionCode:\s*(\d+)') {
  $versionCode = [int]$Matches[1]
}
Write-Host "Target VersionCode: $versionCode"

Push-Location $workRoot
try {
  Write-Host 'Generating android/ (expo prebuild with latest config & google-services.json)...'
  npx expo prebuild --platform android --clean
  if ($LASTEXITCODE -ne 0) { throw 'expo prebuild failed' }
  node ./scripts/patch-gradle.js

  # Ensure android/app has the exact google-services.json
  Copy-Item -Path (Join-Path $mobileRoot 'google-services.json') -Destination (Join-Path $workRoot 'android\app\google-services.json') -Force

  Write-Host 'Syncing launcher + splash icons from current assets...'
  node ./scripts/sync-android-icons.js
  if ($LASTEXITCODE -ne 0) { throw 'sync-android-icons failed' }

  $cxx = Join-Path $workRoot 'android\app\.cxx'
  if (Test-Path $cxx) {
    Remove-Item -Recurse -Force $cxx -ErrorAction SilentlyContinue
  }

  # Build AAB for all production Android devices
  $env:ORG_GRADLE_PROJECT_reactNativeArchitectures = 'armeabi-v7a,arm64-v8a,x86,x86_64'

  # Configure release signing and version code via Gradle project properties
  $gradleArgs = @(
    'bundleRelease',
    '--no-daemon',
    "-Pandroid.injected.version.code=$versionCode",
    "-Pandroid.injected.signing.store.file=$mirrorKeystore",
    '-Pandroid.injected.signing.store.password=bakibook2026',
    '-Pandroid.injected.signing.key.alias=bakibook',
    '-Pandroid.injected.signing.key.password=bakibook2026'
  )

  Write-Host "Building signed Google Play App Bundle (bundleRelease, versionCode $versionCode)..."
  Push-Location android
  try {
    if ($IsWindows -or $env:OS -eq 'Windows_NT') {
      .\gradlew.bat @gradleArgs
    } else {
      ./gradlew @gradleArgs
    }
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle bundleRelease failed (exit $LASTEXITCODE)."
    }
  } finally {
    Pop-Location
  }

  $bundleDir = Join-Path $workRoot 'android\app\build\outputs\bundle\release'
  $aab = Get-ChildItem -Path $bundleDir -Filter '*.aab' -ErrorAction SilentlyContinue |
    Select-Object -First 1

  if ($aab) {
    $destDir = Join-Path $mobileRoot 'dist'
    if (-not (Test-Path $destDir)) {
      New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    $copied = Join-Path $destDir 'BakiBook.aab'
    Copy-Item -Path $aab.FullName -Destination $copied -Force
    Write-Host ''
    Write-Host "Play Store AAB Ready: $copied" -ForegroundColor Green
    Write-Host "You can now upload $copied to Google Play Console (Internal testing / Production track)."
  } else {
    Write-Error "AAB file not found under $bundleDir"
  }
} finally {
  Restore-MobileEnv
  Pop-Location
}

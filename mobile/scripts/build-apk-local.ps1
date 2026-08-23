# Build a release APK locally (installable BakiBook.apk, no EAS).
# Usage: .\scripts\build-apk-local.ps1
# Output: android\app\build\outputs\apk\release\BakiBook.apk (also copied to dist\BakiBook.apk)

$ErrorActionPreference = 'Stop'
$mobileRoot = (Resolve-Path (Split-Path -Parent $PSScriptRoot)).Path

function Resolve-JdkHome {
  param([string[]]$Candidates)
  foreach ($candidate in $Candidates) {
    if (-not $candidate) { continue }
    $javaExe = Join-Path $candidate 'bin\java.exe'
    if (Test-Path $javaExe) { return $candidate }
  }
  return $null
}

function Sync-ShortMirror {
  param([string]$Source, [string]$Mirror)
  # Mirror was often weeks stale — always copy latest sources before building.
  Write-Host "Syncing latest sources -> $Mirror"
  if (-not (Test-Path $Mirror)) {
    New-Item -ItemType Directory -Path $Mirror -Force | Out-Null
  }
  & robocopy $Source $Mirror /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NC /NS /NP `
    /XD node_modules .git dist .expo `
    'android\app\build' 'android\app\.cxx' 'android\.gradle' 'android\build' `
    /XF '*.apk' | Out-Null
  # robocopy: 0-7 = success/partial copy; >=8 = failure
  if ($LASTEXITCODE -ge 8) {
    throw "Failed syncing project to $Mirror (robocopy exit $LASTEXITCODE)"
  }
  $script:LASTEXITCODE = 0

  # Point mirror node_modules at the real project so plugins like expo-font resolve.
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
      Write-Host 'Removing stale mirror node_modules (can take a minute)...'
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
  # Prefer a short mirror copy (avoids Windows 260-char path + subst drive issues with Expo)
  $mirror = 'C:\bk\mobile'
  if ((Test-Path $mirror) -or $Path.Length -gt 90 -or $Path -match 'OneDrive') {
    Sync-ShortMirror -Source $Path -Mirror $mirror
    Write-Host "Using short mirror $mirror"
    return $mirror
  }
  # Release CMake paths exceed Windows 260-char limit even from moderate project paths.
  foreach ($letter in @('B', 'K', 'M', 'Z')) {
    $drive = "${letter}:"
    $existing = cmd /c "subst" 2>$null | Select-String "^\s*$([regex]::Escape($drive))"
    if ($existing) {
      if ($existing -match [regex]::Escape($Path)) {
        Write-Host "Using short path $drive -> $Path"
        return "${drive}\"
      }
      cmd /c "subst $drive /d" 2>$null | Out-Null
    }
    cmd /c "subst $drive `"$Path`"" | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Mapped short path $drive -> $Path (avoids Windows 260-char path limit)"
      return "${drive}\"
    }
  }
  return $Path
}

$jdk = Resolve-JdkHome @(
  $env:JAVA_HOME
  'C:\Program Files\Android\Android Studio\jbr'
  "${env:ProgramFiles(x86)}\Android\Android Studio\jbr"
  (Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr')
)

if (-not $jdk) {
  Write-Error 'JDK not found. Install Android Studio or set JAVA_HOME.'
}

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

# Release APK must hit production API + Web Google client (not local emulator .env)
$prodApi = 'https://bakibookapp.onrender.com/api'
$prodGoogleWeb = '129286948746-c38ufv6he052pbr9c9l9a0upvr58e5fr.apps.googleusercontent.com'
$envFile = Join-Path $mobileRoot '.env'
$envBackup = Join-Path $mobileRoot '.env.bakibook-apk-backup'
$restoredEnv = $false

function Restore-MobileEnv {
  if ($restoredEnv) { return }
  if (Test-Path $envBackup) {
    Copy-Item -Path $envBackup -Destination $envFile -Force
    Remove-Item -Path $envBackup -Force -ErrorAction SilentlyContinue
    Write-Host 'Restored mobile/.env (dev settings)'
  }
  $script:restoredEnv = $true
}

function Write-ReleaseEnv {
  param([string]$Path)
  # ASCII-only comments — em dashes break dotenv export parsing on Windows.
  @(
    '# Temporary values for release APK build (restored after build)'
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
Write-Host "Release env: API=$prodApi"
Write-Host "Release env: Google Web client=$prodGoogleWeb"

$workRoot = Get-ShortMobileRoot -Path $mobileRoot
Write-Host "Working directory=$workRoot"

# Ensure mirror also has the release .env (sync may have run before write, or mirror is separate)
Write-ReleaseEnv -Path (Join-Path $workRoot '.env')

Push-Location $workRoot
try {
  if (-not (Test-Path 'android')) {
    Write-Host 'Generating android/ (expo prebuild)...'
    npx expo prebuild --platform android --clean
    if ($LASTEXITCODE -ne 0) { throw 'expo prebuild failed' }
    node ./scripts/patch-gradle.js
  }

  $cxx = Join-Path $workRoot 'android\app\.cxx'
  if (Test-Path $cxx) {
    Write-Host "Clearing stale CMake cache: $cxx"
    Remove-Item -Recurse -Force $cxx -ErrorAction SilentlyContinue
  }

  Write-Host 'Building release APK (assembleRelease)...'
  Push-Location android
  try {
    if ($IsWindows -or $env:OS -eq 'Windows_NT') {
      .\gradlew.bat assembleRelease --no-daemon
    } else {
      ./gradlew assembleRelease --no-daemon
    }
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle assembleRelease failed (exit $LASTEXITCODE). Not copying an old APK."
    }
  } finally {
    Pop-Location
  }

  $apk = Join-Path $workRoot 'android\app\build\outputs\apk\release\BakiBook.apk'
  if (-not (Test-Path $apk)) {
    $fallback = Get-ChildItem -Path (Join-Path $workRoot 'android\app\build\outputs\apk\release') -Filter '*.apk' -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($fallback) { $apk = $fallback.FullName }
  }

  if (Test-Path $apk) {
    $destDir = Join-Path $mobileRoot 'dist'
    if (-not (Test-Path $destDir)) {
      New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    $copied = Join-Path $destDir 'BakiBook.apk'
    Copy-Item -Path $apk -Destination $copied -Force
    Write-Host ''
    Write-Host "APK ready: $copied" -ForegroundColor Green
    Write-Host "Also at: $apk"
    Write-Host ('Copy to your phone and install, or: adb install -r "' + $copied + '"')
  } else {
    Write-Error 'APK not found under android\app\build\outputs\apk\release\'
  }
} finally {
  Restore-MobileEnv
  Pop-Location
}

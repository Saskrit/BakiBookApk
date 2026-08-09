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

function Get-ShortMobileRoot {
  param([string]$Path)
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
$env:GRADLE_USER_HOME = 'C:\bk-gradle'
if (-not (Test-Path $env:GRADLE_USER_HOME)) {
  New-Item -ItemType Directory -Path $env:GRADLE_USER_HOME -Force | Out-Null
}
$env:Path = "$jdk\bin;$sdk\platform-tools;" + $env:Path

$workRoot = Get-ShortMobileRoot -Path $mobileRoot
Write-Host "Working directory=$workRoot"

Push-Location $workRoot
try {
  if (-not (Test-Path 'android')) {
    Write-Host 'Generating android/ (expo prebuild)...'
    npx expo prebuild --platform android --clean
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
  Pop-Location
}

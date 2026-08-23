# Run BakiBook on Android emulator/device.
# Sets JAVA_HOME + ANDROID_HOME and uses a short SUBST path on Windows (fixes MAX_PATH / OneDrive build failures).
# Usage: .\scripts\run-android.ps1

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
  # SUBST can break Expo autolinking; only use for very long paths or OneDrive.
  $needsShort = $Path.Length -gt 90 -or $Path -match 'OneDrive'
  if (-not $needsShort) { return $Path }

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

  Write-Error @"
Project path is too long for Android native builds on Windows.
Move the project to e.g. C:\Projects\BakiBookApp\mobile and try again.
"@
}

function Clear-AndroidNativeCache {
  param([string]$Root)
  $paths = @(
    (Join-Path $Root 'android\app\.cxx'),
    (Join-Path $Root 'android\build'),
    (Join-Path $Root 'android\.gradle'),
    (Join-Path $Root 'node_modules\react-native-screens\android\.cxx')
  )
  foreach ($p in $paths) {
    if (Test-Path $p) {
      Write-Host "Clearing stale build cache: $p"
      Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue
    }
  }
}

$sdk = if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
  $env:ANDROID_HOME
} else {
  Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}

$jdk = Resolve-JdkHome @(
  $env:JAVA_HOME
  'C:\Program Files\Android\Android Studio\jbr'
  "${env:ProgramFiles(x86)}\Android\Android Studio\jbr"
  (Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr')
)

if (-not $jdk) {
  Write-Error 'JDK not found. Install Android Studio or set JAVA_HOME to its jbr folder (JDK 17).'
}

$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
# Short path keeps Gradle transform cache under the 260-char Windows limit
$env:GRADLE_USER_HOME = 'C:\bk-gradle'
if (-not (Test-Path $env:GRADLE_USER_HOME)) {
  New-Item -ItemType Directory -Path $env:GRADLE_USER_HOME -Force | Out-Null
}
$env:Path = "$jdk\bin;$sdk\platform-tools;$sdk\emulator;" + $env:Path

$workRoot = Get-ShortMobileRoot -Path $mobileRoot
if ($workRoot -ne $mobileRoot) {
  Clear-AndroidNativeCache -Root $workRoot
}

Write-Host "JAVA_HOME=$jdk"
Write-Host "ANDROID_HOME=$sdk"
Write-Host "Working directory=$workRoot"

$adb = Join-Path $sdk 'platform-tools\adb.exe'
# adb prints "daemon not running; starting now" on stderr — PowerShell treats that as a terminating error.
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& $adb start-server 2>$null | Out-Null
$deviceLines = & $adb devices
$ErrorActionPreference = $prevEap
$devices = $deviceLines | Select-String '\tdevice$'

if (-not $devices) {
  $emulator = Join-Path $sdk 'emulator\emulator.exe'
  $avds = & $emulator -list-avds 2>$null
  if ($avds) {
    $avd = ($avds | Select-Object -First 1).ToString().Trim()
    Write-Host "Starting emulator: $avd"
    Start-Process -FilePath $emulator -ArgumentList @('-avd', $avd) -WindowStyle Normal
    Write-Host 'Waiting for emulator to boot...'
    & $adb wait-for-device
    $deadline = (Get-Date).AddMinutes(3)
    do {
      Start-Sleep -Seconds 3
      $booted = & $adb shell getprop sys.boot_completed 2>$null
    } while ($booted -ne '1' -and (Get-Date) -lt $deadline)
  } else {
    Write-Error 'No emulator running. Create an AVD in Android Studio Device Manager, then retry.'
  }
}

Push-Location $workRoot
try {
  npx expo run:android @args
} finally {
  Pop-Location
}

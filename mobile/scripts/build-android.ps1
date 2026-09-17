# Build on EAS, then automatically download APK and run on Android emulator.
# Usage:
#   .\scripts\build-android.ps1 preview
#   .\scripts\build-android.ps1 preview -NoAutoRun
#   .\scripts\build-android.ps1 preview -CopyToLocalAppData

param(
  [ValidateSet('production', 'preview', 'apk')]
  [string]$Profile = 'production',
  [switch]$NoAutoRun,
  [switch]$CopyToLocalAppData,
  [string]$AvdName = 'Medium_Phone',
  [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'android-sdk.ps1')

$mobileRoot = (Resolve-Path (Split-Path -Parent $PSScriptRoot)).Path
$buildRoot = $mobileRoot
$autoRun = -not $NoAutoRun -and ($Profile -in @('preview', 'apk'))

if ($Profile -eq 'production' -and -not $NoAutoRun) {
  $autoRun = $false
}

if ($CopyToLocalAppData) {
  $buildRoot = Join-Path $env:LOCALAPPDATA 'bakibook-eas-build'
  Write-Host "Copying project to $buildRoot ..."
  if (Test-Path $buildRoot) {
    Remove-Item -Recurse -Force $buildRoot
  }
  New-Item -ItemType Directory -Path $buildRoot | Out-Null
  $excludeDirs = @('node_modules', '.expo', '.git', '.claude', 'android', 'ios')
  Get-ChildItem -Path $mobileRoot -Force | ForEach-Object {
    if ($excludeDirs -contains $_.Name) { return }
    Copy-Item -Path $_.FullName -Destination $buildRoot -Recurse -Force
  }
  $env:EAS_NO_VCS = '1'
} else {
  Remove-Item Env:EAS_NO_VCS -ErrorAction SilentlyContinue
}

Push-Location $buildRoot
try {
  if (-not (Test-Path 'node_modules')) {
    Write-Host 'Installing dependencies...'
    npm install --no-fund --no-audit --loglevel=error
  }
} finally {
  Pop-Location
}

Push-Location $buildRoot
try {
  $easArgs = @(
    'build',
    '--platform', 'android',
    '--profile', $Profile,
    '--wait'
  )
  if ($NonInteractive) {
    $easArgs += '--non-interactive'
  }
  if ($args.Count -gt 0) { $easArgs += $args }

  Write-Host "EAS build (profile: $Profile, auto-run emulator: $autoRun)"
  Invoke-NpxQuiet --yes eas-cli @easArgs
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  if (-not $autoRun) {
    Write-Host 'Build finished. Download from https://expo.dev/accounts/saskreet/projects/bakibook/builds'
    exit 0
  }

  Write-Host 'Build finished - installing on emulator...'
  $buildId = Get-LatestFinishedBuildId -Profile $Profile -MobileRoot $buildRoot
  if (-not $buildId) {
    throw 'Could not find finished build ID.'
  }

  $outApk = Join-Path $mobileRoot 'dist\BakiBook.apk'
  Download-EasApk -BuildId $buildId -MobileRoot $buildRoot -OutApk $outApk

  $tools = Initialize-AndroidSdkEnv
  Start-BakiBookEmulator -EmulatorExe $tools.Emulator -Adb $tools.Adb -PreferredAvd $AvdName
  Install-ApkOnDevice -Adb $tools.Adb -ApkPath $outApk
} finally {
  Pop-Location
}

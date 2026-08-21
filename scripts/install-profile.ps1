# install-profile.ps1 - hot-wire dsh-updater into the `web` profile.
#
# 1) Links the built package into the profile's node_modules as a junction.
# 2) Adds `dsh-updater` to the profile package.json `dependencies` and to
#    `dsh.profile.bundles` (idempotently).
#
# After this you must reinstall/rebuild the profile so the bundle patch row
# lands, then reload the Web GUI. In a networked environment prefer:
#
#   dsh plugin --profile web add link:<this-dir>
#
# Run from the dsh-updater package directory:
#   pwsh ./scripts/install-profile.ps1

$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $PSScriptRoot
$profileRoot = Join-Path $env:USERPROFILE '.dsh\profiles\web'
$manifest = Join-Path $profileRoot 'package.json'
$target = Join-Path $profileRoot 'node_modules\dsh-updater'

if (-not (Test-Path (Join-Path $here 'lib\index.js'))) {
  throw 'lib/index.js not found - build the plugin first (tsc + tsdown), see README "Build".'
}
if (-not (Test-Path $manifest)) {
  throw "profile manifest not found: $manifest"
}

# 1) Junction the package into the profile node_modules.
$nm = Split-Path -Parent $target
if (-not (Test-Path $nm)) {
  New-Item -ItemType Directory -Force -Path $nm | Out-Null
}
if (Test-Path $target) {
  Remove-Item $target -Force -Recurse
}
New-Item -ItemType Junction -Force -Path $target -Target $here | Out-Null
Write-Host "linked $target -> $here"

# 2) Patch the manifest (dependency + bundle entry), preserving exact formatting.
$json = Get-Content $manifest -Raw

# 2a) dependencies: insert "dsh-updater": "link:<here>"
$depSpec = 'link:' + $here.Replace('\', '/')
if ($json -match '"dsh-updater"\s*:\s*"') {
  $json = [regex]::Replace($json, '"dsh-updater"\s*:\s*"[^"]*"', ('"dsh-updater": "' + $depSpec + '"'), 1)
} else {
  # Add as the first dependency entry after the opening brace of "dependencies".
  if ($json -match '"dependencies"\s*:\s*\{') {
    $json = [regex]::Replace($json, '"dependencies"\s*:\s*\{', ('"dependencies": { "' + 'dsh-updater": "' + $depSpec + '",'), 1)
  } else {
    throw 'profile package.json has no "dependencies" object'
  }
}

# 2b) bundles: add "dsh-updater" to dsh.profile.bundles if absent.
if ($json -notmatch '"bundles"\s*:\s*\[[^\]]*"dsh-updater"') {
  if ($json -match '"bundles"\s*:\s*\[\s*\]') {
    $json = [regex]::Replace($json, '"bundles"\s*:\s*\[\s*\]', '"bundles": ["dsh-updater"]', 1)
  } elseif ($json -match '"bundles"\s*:\s*\[') {
    $json = [regex]::Replace($json, '"bundles"\s*:\s*\[', '"bundles": ["dsh-updater",', 1)
  } else {
    throw 'profile package.json has no dsh.profile.bundles array'
  }
}

Set-Content -Path $manifest -Value $json -Encoding UTF8 -NoNewline
Write-Host "patched $manifest"

Write-Host ''
Write-Host 'Next: reinstall/rebuild the profile (pnpm install) and reload the Web GUI.'
Write-Host 'In a networked environment, `dsh plugin --profile web add link:<this-dir>` makes this unnecessary.'

<#
.SYNOPSIS
  Builds the downloadable FlapClock release archive.

.DESCRIPTION
  Bundles the runtime files, docs and the screensaver source into
  dist\FlapClock-<version>.zip and writes SHA256SUMS.txt next to it.
  The archive is what you attach to a GitHub Release, so it deliberately
  excludes the WebView2 profile cache and any test scratch files.

.PARAMETER Version
  Version number for the archive name and the changelog header.

.EXAMPLE
  .\build-release.ps1 -Version 1.0.0
#>
param(
  [Parameter(Mandatory = $false)]
  [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"
$src   = $PSScriptRoot
$dist  = Join-Path $src "dist"
$stage = Join-Path $env:TEMP "flapclock-pkg-$Version"
$zip   = Join-Path $dist "FlapClock-$Version.zip"

# Runtime files plus docs. The .cs ships too, so the rebuild instructions in the
# README actually work straight out of the archive.
$files = @(
  "index.html", "styles.css", "clock.js",
  "FlapClock.vbs", "start.bat", "FlapClock.command", "FlapClock.scr",
  "Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "WebView2Loader.dll",
  "FlapClockScreensaver.cs",
  "README.md", "LICENSE", "CHANGELOG.md"
)

foreach ($d in @($stage, $dist)) {
  if (Test-Path $d) { Remove-Item $d -Recurse -Force }
  New-Item -ItemType Directory -Path $d -Force | Out-Null
}

$missing = @()
foreach ($f in $files) {
  $p = Join-Path $src $f
  if (Test-Path $p) { Copy-Item $p $stage } else { $missing += $f }
}
if ($missing.Count) {
  throw @"
Missing from the package:
  $($missing -join "`n  ")

If FlapClock.scr or the WebView2 assemblies are absent, see "Rebuilding after a
code change" in README.md.
"@
}

Compress-Archive -Path "$stage\*" -DestinationPath $zip -CompressionLevel Optimal
Remove-Item $stage -Recurse -Force

$hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
"$hash  FlapClock-$Version.zip" | Set-Content -Path (Join-Path $src "SHA256SUMS.txt") -Encoding ascii

"package : dist\FlapClock-$Version.zip"
"size    : {0:N0} KB" -f ((Get-Item $zip).Length / 1KB)
"sha256  : $hash"
""
"contents:"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($zip)
$z.Entries | ForEach-Object { "  {0,-34} {1,8:N0} B" -f $_.FullName, $_.Length }
$z.Dispose()

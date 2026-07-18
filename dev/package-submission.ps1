param(
  [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $projectRoot "dist"
}

$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$projectFullPath = [System.IO.Path]::GetFullPath($projectRoot)
if (-not $outputRoot.StartsWith($projectFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Output directory must stay inside the project: $projectFullPath"
}

$packageName = "DROP_DESTINY_SUBMISSION"
$stagingRoot = Join-Path $outputRoot "staging"
$packageRoot = Join-Path $stagingRoot $packageName
$zipPath = Join-Path $outputRoot "$packageName.zip"

if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}
New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null

$runtimeFiles = @(
  "index.html",
  "styles.css",
  "app.js",
  "data.js",
  "style-engine.js",
  "audio-engine.js",
  "visualizer.js",
  "wavetables.js",
  "audio-assets.js",
  "ending-assets.js",
  "README.md",
  "spec.md",
  "ASSET_LICENSES.md"
)

foreach ($relativePath in $runtimeFiles) {
  $source = Join-Path $projectRoot $relativePath
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Required file missing: $relativePath"
  }
  Copy-Item -LiteralPath $source -Destination (Join-Path $packageRoot $relativePath)
}

foreach ($directory in @("assets", "docs")) {
  $source = Join-Path $projectRoot $directory
  if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    throw "Required directory missing: $directory"
  }
  Copy-Item -LiteralPath $source -Destination (Join-Path $packageRoot $directory) -Recurse
}

$runtimeScanFiles = @(
  "index.html", "styles.css", "app.js", "data.js", "style-engine.js",
  "audio-engine.js", "visualizer.js", "wavetables.js", "audio-assets.js", "ending-assets.js"
)
$externalRuntimeRefs = Select-String -Path ($runtimeScanFiles | ForEach-Object { Join-Path $packageRoot $_ }) -Pattern 'https?://' -AllMatches
if ($externalRuntimeRefs) {
  $locations = $externalRuntimeRefs | ForEach-Object { "$($_.Path):$($_.LineNumber)" }
  throw "External runtime URL found: $($locations -join ', ')"
}

$fontPath = Join-Path $packageRoot "assets\fonts\Teko.woff2"
$fontLicensePath = Join-Path $packageRoot "assets\fonts\OFL.txt"
if (-not (Test-Path -LiteralPath $fontPath) -or -not (Test-Path -LiteralPath $fontLicensePath)) {
  throw "Bundled font or font license is missing."
}

Compress-Archive -LiteralPath $packageRoot -DestinationPath $zipPath -CompressionLevel Optimal
$zip = Get-Item -LiteralPath $zipPath
$limit = 50MB
if ($zip.Length -ge $limit) {
  throw "ZIP is $([Math]::Round($zip.Length / 1MB, 2)) MiB; task limit is below 50 MiB."
}

$manifestPath = Join-Path $outputRoot "PACKAGE_MANIFEST.txt"
$fileList = Get-ChildItem -LiteralPath $packageRoot -Recurse -File |
  Sort-Object FullName |
  ForEach-Object {
    $relative = $_.FullName.Substring($packageRoot.Length + 1).Replace('\', '/')
    "{0,10}  {1}" -f $_.Length, $relative
  }
$hash = Get-FileHash -LiteralPath $zipPath -Algorithm SHA256
@(
  "Package: $($zip.Name)",
  "SizeBytes: $($zip.Length)",
  "SizeMiB: $([Math]::Round($zip.Length / 1MB, 2))",
  "SHA256: $($hash.Hash)",
  "",
  "Files:",
  $fileList
) | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Output "ZIP: $zipPath"
Write-Output "Size: $([Math]::Round($zip.Length / 1MB, 2)) MiB"
Write-Output "SHA256: $($hash.Hash)"
Write-Output "Manifest: $manifestPath"

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

$packageName = -join @(
  [char]0x5362, [char]0x5B50, [char]0x5BB8, '_',
  [char]0x65B9, [char]0x5411, 'A'
)
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
  "ASSET_LICENSES.md"
)

foreach ($relativePath in $runtimeFiles) {
  $source = Join-Path $projectRoot $relativePath
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Required file missing: $relativePath"
  }
  Copy-Item -LiteralPath $source -Destination (Join-Path $packageRoot $relativePath)
}

$assetsSource = Join-Path $projectRoot "assets"
if (-not (Test-Path -LiteralPath $assetsSource -PathType Container)) {
  throw "Required directory missing: assets"
}
Copy-Item -LiteralPath $assetsSource -Destination (Join-Path $packageRoot "assets") -Recurse

$retroSource = Join-Path $projectRoot "docs\RETROSPECTIVE.md"
if (-not (Test-Path -LiteralPath $retroSource -PathType Leaf)) {
  throw "Required review document missing: docs/RETROSPECTIVE.md"
}
$retroFileName = -join @(
  [char]0x590D, [char]0x76D8, [char]0x6587, [char]0x6863, '.md'
)
Copy-Item -LiteralPath $retroSource -Destination (Join-Path $packageRoot $retroFileName)

$workbuddySource = Join-Path $projectRoot "docs\workbuddy"
$workbuddyTarget = Join-Path $packageRoot "docs\workbuddy"
if (-not (Test-Path -LiteralPath $workbuddySource -PathType Container)) {
  throw "Required WorkBuddy screenshots missing: docs/workbuddy"
}
New-Item -ItemType Directory -Path $workbuddyTarget -Force | Out-Null
Copy-Item -Path (Join-Path $workbuddySource "*.png") -Destination $workbuddyTarget

$screenshotCount = @(Get-ChildItem -LiteralPath $workbuddyTarget -Filter "*.png" -File).Count
if ($screenshotCount -lt 2 -or $screenshotCount -gt 3) {
  throw "README requires 2-3 WorkBuddy screenshots; found $screenshotCount."
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

Compress-Archive -Path (Join-Path $packageRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal
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

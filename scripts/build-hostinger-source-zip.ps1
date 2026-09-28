param([string]$OutputDirectory = '.local-qa\hostinger')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root $OutputDirectory
if (-not (Test-Path -LiteralPath $output)) { New-Item -ItemType Directory -Path $output | Out-Null }
$zipPath = Join-Path $output 'als-hostinger-staging-source.zip'
if (Test-Path -LiteralPath $zipPath) { throw 'Archive already exists; choose a fresh output directory rather than overwriting evidence.' }
$topFiles = @('package.json','package-lock.json','tsconfig.json','next.config.ts','postcss.config.mjs')
$files = @($topFiles | ForEach-Object { Get-Item -LiteralPath (Join-Path $root $_) })
$files += @(Get-ChildItem -LiteralPath (Join-Path $root 'src') -Recurse -File)
$files += @(Get-ChildItem -LiteralPath (Join-Path $root 'public') -Recurse -File)
$buildTypecheckScripts = @(
  'scripts/pathology-import-model.mjs',
  'scripts/question-reference-cleanup-model.mjs',
  'scripts/recorded-classes-client-content.mjs',
  'scripts/build-recording-hash-worker.mjs',
  'scripts/recording-hash.worker.entry.mjs'
)
$files += @($buildTypecheckScripts | ForEach-Object { Get-Item -LiteralPath (Join-Path $root $_) })
$entries = @($files | ForEach-Object {
  [pscustomobject]@{ Source = $_.FullName; Entry = $_.FullName.Substring($root.Length + 1).Replace('\','/') }
} | Sort-Object Entry)
if ($entries.Count -lt 100 -or $entries.Entry -notcontains 'package.json' -or $entries.Entry -notcontains 'package-lock.json' -or $entries.Entry -notcontains 'src/proxy.ts' -or @($buildTypecheckScripts | Where-Object { $entries.Entry -notcontains $_ }).Count) {
  throw 'Allowlist is incomplete.'
}
$denied = '(?i)(^|/)(\.env[^/]*|\.git|node_modules|\.next|\.local-qa|out|build|stitch_als_learning_nexus|.*\.zip|.*\.pem)(/|$)'
$secret = 'sb_secret_[A-Za-z0-9]{12,}|sbp_[A-Za-z0-9]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|(?m)^(CF_REALTIME_APP_SECRET|CF_TURN_KEY_API_TOKEN|R2_SECRET_ACCESS_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*\S+'
foreach ($entry in $entries) {
  if ($entry.Entry -match $denied) { throw "Denied archive entry: $($entry.Entry)" }
  if ($entry.Entry -match '\.(ts|tsx|js|mjs|json|yaml|css)$') {
    $content = Get-Content -LiteralPath $entry.Source -Raw -Encoding UTF8
    if ($content -match $secret) { throw "Potential secret in $($entry.Entry)" }
  }
}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($entry in $entries) {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $entry.Source, $entry.Entry, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $zip.Dispose() }
$verify = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $names = @($verify.Entries | ForEach-Object { $_.FullName })
  if ($names.Count -ne $entries.Count -or @($names | Where-Object { $_ -match $denied }).Count) { throw 'Archive content verification failed.' }
} finally { $verify.Dispose() }
$digest = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
[pscustomobject]@{ Path = $zipPath; Entries = $entries.Count; Bytes = (Get-Item -LiteralPath $zipPath).Length; SHA256 = $digest }

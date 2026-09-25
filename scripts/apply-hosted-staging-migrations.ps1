param(
  [Parameter(Mandatory = $true)][string]$AccessTokenEnvFile,
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$projectRef = 'slghshcdaijbcjfoqerq'
$organizationId = 'oenarbsvxrmnsvugjdrz'
$projectName = 'als-live-staging'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$migrationDirectory = Join-Path $repositoryRoot 'supabase\migrations'
$files = @(Get-ChildItem -LiteralPath $migrationDirectory -Filter '*.sql' -File | Sort-Object Name)
$tokenLine = Get-Content -LiteralPath $AccessTokenEnvFile | Where-Object { $_ -match '^SUPABASE_ACCESS_TOKEN=' } | Select-Object -First 1
if (-not $tokenLine) { throw 'SUPABASE_ACCESS_TOKEN is missing from the supplied ignored configuration.' }
$accessToken = $tokenLine.Substring($tokenLine.IndexOf('=') + 1).Trim('"')
if (-not $accessToken) { throw 'SUPABASE_ACCESS_TOKEN is empty.' }
$headers = @{ Authorization = "Bearer $accessToken" }
$base = "https://api.supabase.com/v1/projects/$projectRef"

# Recheck the exact target before every write. Never infer a project from the
# active CLI link, browser tab, or an environment variable copied from ALS Production.
$project = Invoke-RestMethod -Uri $base -Headers $headers -Method Get
if ($project.ref -ne $projectRef -or $project.organization_id -ne $organizationId -or $project.name -ne $projectName) {
  throw 'Project identity does not match isolated ALS staging.'
}
if ($project.status -ne 'ACTIVE_HEALTHY') { throw "Staging project is not healthy: $($project.status)" }
$history = @(Invoke-RestMethod -Uri "$base/database/migrations" -Headers $headers -Method Get | Where-Object { $_ })
$appliedNames = @($history | ForEach-Object { $_.name })
$remaining = @($files | Where-Object { $_.BaseName -notin $appliedNames })
Write-Output "Verified $projectName ($projectRef), $($files.Count) committed migrations, $($history.Count) recorded, $($remaining.Count) remaining."
if (-not $Apply) { return }

foreach ($file in $remaining) {
  # Inspect live history again on retries. Never replay an already-recorded migration.
  $history = @(Invoke-RestMethod -Uri "$base/database/migrations" -Headers $headers -Method Get | Where-Object { $_ })
  if ($file.BaseName -in @($history | ForEach-Object { $_.name })) { continue }
  $project = Invoke-RestMethod -Uri $base -Headers $headers -Method Get
  if ($project.ref -ne $projectRef -or $project.organization_id -ne $organizationId -or $project.name -ne $projectName) {
    throw 'Project identity changed during migration run.'
  }
  $body = @{ name = $file.BaseName; query = (Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8) } | ConvertTo-Json -Depth 4 -Compress
  Invoke-RestMethod -Uri "$base/database/migrations" -Headers $headers -Method Post -ContentType 'application/json; charset=utf-8' -Body $body | Out-Null
  Write-Output "Applied $($file.BaseName)"
}

$history = @(Invoke-RestMethod -Uri "$base/database/migrations" -Headers $headers -Method Get | Where-Object { $_ })
$missing = @($files | Where-Object { $_.BaseName -notin @($history | ForEach-Object { $_.name }) })
if ($missing.Count) { throw "$($missing.Count) committed migrations are not recorded remotely." }
Write-Output "Verified all $($files.Count) committed migrations in staging history."

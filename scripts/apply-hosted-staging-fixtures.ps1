param([Parameter(Mandatory = $true)][string]$AccessTokenEnvFile)
$ErrorActionPreference = 'Stop'
$ref = 'slghshcdaijbcjfoqerq'
$base = "https://api.supabase.com/v1/projects/$ref"
$line = Get-Content -LiteralPath $AccessTokenEnvFile | Where-Object { $_ -match '^SUPABASE_ACCESS_TOKEN=' } | Select-Object -First 1
if (-not $line) { throw 'Management token missing' }
$token = $line.Substring($line.IndexOf('=') + 1).Trim('"')
$headers = @{ Authorization = "Bearer $token" }
$project = Invoke-RestMethod -Uri $base -Headers $headers -Method Get
if ($project.ref -ne $ref -or $project.name -ne 'als-live-staging' -or $project.organization_id -ne 'oenarbsvxrmnsvugjdrz' -or $project.status -ne 'ACTIVE_HEALTHY') {
  throw 'Refusing fixture write to unexpected project'
}
$sqlPath = Join-Path $PSScriptRoot 'hosted-staging-fixtures.sql'
$body = @{ query = (Get-Content -LiteralPath $sqlPath -Raw -Encoding UTF8) } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "$base/database/query" -Headers $headers -Method Post -ContentType 'application/json; charset=utf-8' -Body $body | Out-Null
Write-Output "Applied synthetic fixtures to verified $($project.name) ($ref)."

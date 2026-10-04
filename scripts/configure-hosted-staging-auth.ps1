param(
  [Parameter(Mandatory = $true)][string]$AccessTokenEnvFile,
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$ref = 'slghshcdaijbcjfoqerq'
$org = 'oenarbsvxrmnsvugjdrz'
$origin = 'https://darkgreen-camel-484366.hostingersite.com'
$tokenLine = Get-Content -LiteralPath $AccessTokenEnvFile | Where-Object { $_ -match '^SUPABASE_ACCESS_TOKEN=' } | Select-Object -First 1
if (-not $tokenLine) { throw 'Management token missing from ignored local config.' }
$token = $tokenLine.Substring($tokenLine.IndexOf('=') + 1).Trim('"')
$headers = @{ Authorization = "Bearer $token" }
$base = "https://api.supabase.com/v1/projects/$ref"
$project = Invoke-RestMethod -Uri $base -Headers $headers -Method Get
if ($project.ref -ne $ref -or $project.organization_id -ne $org -or $project.name -ne 'als-live-staging' -or $project.status -ne 'ACTIVE_HEALTHY') {
  throw 'Refusing to alter an unverified Supabase project.'
}
$current = Invoke-RestMethod -Uri "$base/config/auth" -Headers $headers -Method Get
$existingUrl = [string]$current.site_url
$existingRedirects = [string]$current.uri_allow_list
if ($existingUrl -and $existingUrl -notin @('http://localhost:3000', $origin)) {
  throw 'Staging Auth Site URL has an unexpected existing value.'
}
if ($existingRedirects -and $existingRedirects -match '(?i)alslearning\.vercel|dvmahmkapgtjfqmoottt') {
  throw 'Staging Auth redirect list unexpectedly references ALS Production.'
}
Write-Output "Verified isolated staging Auth config. Current site URL: $existingUrl."
Write-Output "Current redirect entries: $existingRedirects"
if (-not $Apply) { return }
$redirects = @($origin, "$origin/auth/callback") -join ','
$body = @{ site_url = $origin; uri_allow_list = $redirects } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "$base/config/auth" -Headers $headers -Method Patch -ContentType 'application/json' -Body $body | Out-Null
$updated = Invoke-RestMethod -Uri "$base/config/auth" -Headers $headers -Method Get
if ($updated.site_url -ne $origin -or $updated.uri_allow_list -ne $redirects) {
  throw 'Staging Auth URL configuration did not verify after update.'
}
Write-Output 'Verified exact staging Site URL and callback allowlist.'

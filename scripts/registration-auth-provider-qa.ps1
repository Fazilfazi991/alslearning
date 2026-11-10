# Disposable local provider test. Never reads staging or production credentials.
$ErrorActionPreference = 'Stop'
$project = 'als-registration-auth-qa'
$compose = 'scripts/fixtures/registration-auth/compose.yml'
$existing = docker ps -a --filter "name=^${project}-" --format '{{.Names}}'
if ($existing) { throw 'The dedicated QA containers already exist. Inspect them before retrying.' }
try {
  docker compose -p $project -f $compose up -d db mail
  if ($LASTEXITCODE -ne 0) { throw 'Could not start local services.' }
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    docker exec "${project}-db-1" pg_isready -h 127.0.0.1 -U postgres -d gotrue *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Local database did not become ready.' }
  docker exec "${project}-db-1" psql -U postgres -d gotrue -c 'create schema auth'
  if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the local Auth schema.' }
  docker compose -p $project -f $compose up -d auth
  if ($LASTEXITCODE -ne 0) { throw 'Could not start local Auth.' }
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    try { $response = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:19421/health' -TimeoutSec 2; if ($response.StatusCode -eq 200) { $ready = $true; break } } catch { }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Local Auth did not become ready.' }
  node scripts/registration-auth-provider-qa.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Local provider checks failed.' }
} finally {
  docker compose -p $project -f $compose down
}

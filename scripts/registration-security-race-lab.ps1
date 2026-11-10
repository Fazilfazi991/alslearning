# Disposable local synthetic DB; does not connect to staging or production.
# Retains its uniquely named containers for an independent rerun.
$ErrorActionPreference = 'Stop'
$security = Join-Path (Get-Location) '..\als-media-urgent-integration'
if ((git -C $security rev-parse HEAD).Trim() -ne '98ca62ea55b7666f59c74707d8dec0313c4366c1') { throw 'Unexpected security baseline' }
git merge-base --is-ancestor 18b7ae273714c1463a5d18a949116868a0e609f8 HEAD
if ($LASTEXITCODE -ne 0) { throw 'Registration branch lacks the agreed baseline' }
git -C $security diff --quiet HEAD -- supabase/migrations
if ($LASTEXITCODE -ne 0) { throw 'Security migrations differ from the committed candidate' }
git diff --quiet HEAD -- supabase/migrations
if ($LASTEXITCODE -ne 0) { throw 'Registration migrations differ from the committed baseline' }
$db='als-registration-race-committed-pg'; $api='als-registration-race-committed-api'; $net='als-registration-race-committed-net'; $port='38129'
foreach ($name in @($db,$api)) { if ((docker ps -a --format '{{.Names}}') -contains $name) { throw "Container already exists: $name" } }
if ((docker network ls --format '{{.Name}}') -contains $net) { throw 'Lab network already exists' }
docker network create --internal $net | Out-Null
docker run -d --name $db --network $net --network-alias checkpoint2-db -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Database start failed' }
for($i=0;$i -lt 30;$i++) { docker exec $db pg_isready -U postgres 2>$null | Out-Null; if($LASTEXITCODE -eq 0){break}; Start-Sleep -Seconds 1 }
if($LASTEXITCODE -ne 0){throw 'Database not ready'}
foreach($path in @('scripts/fixtures/helper-grants-provider.sql','scripts/fixtures/checkpoint2-provider.sql')) {
  Get-Content -LiteralPath (Join-Path $security $path) -Raw | docker exec -i $db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q
  if($LASTEXITCODE -ne 0){throw "Fixture failed: $path"}
}
$reg=Get-ChildItem 'supabase/migrations' -Filter '*.sql'; $sec=Get-ChildItem (Join-Path $security 'supabase/migrations') -Filter '*.sql'
$byName=@{}; foreach($f in $sec){$byName[$f.Name]=$f}; foreach($f in $reg){if($byName.ContainsKey($f.Name) -and (Get-FileHash -Algorithm SHA256 $f.FullName).Hash -ne (Get-FileHash -Algorithm SHA256 $byName[$f.Name].FullName).Hash){throw "Baseline migration differs: $($f.Name)"}; $byName[$f.Name]=$f}
foreach($name in ($byName.Keys | Sort-Object)) {
  Write-Output "Applying $name"
  @('BEGIN;', (Get-Content -LiteralPath $byName[$name].FullName -Raw), 'COMMIT;') | docker exec -i $db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q
  if($LASTEXITCODE -ne 0){throw "Migration failed: $name"}
}
$fixture=Get-Content -LiteralPath (Join-Path $security 'scripts/media-capacity-adversarial-fixture.sql') -Raw
$fixture=$fixture.Replace("('10000000-0000-4000-8000-000000000001','qa-teacher@example.invalid','{}','{}',now(),now())", "('10000000-0000-4000-8000-000000000001','qa-teacher@example.invalid','{""role"":""teacher""}','{}',now(),now())")
$fixture=$fixture.Replace("('10000000-0000-4000-8000-000000000012','student','Synthetic Student Two','qa-student-2@example.invalid',true);", "('10000000-0000-4000-8000-000000000012','student','Synthetic Student Two','qa-student-2@example.invalid',true) on conflict(id) do update set role=excluded.role,full_name=excluded.full_name,email=excluded.email,is_active=excluded.is_active;")
$fixture | docker exec -i $db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q
if($LASTEXITCODE -ne 0){throw 'Synthetic fixture failed'}
'grant select on public.profiles, public.enrollments to authenticated;' | docker exec -i $db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q
if($LASTEXITCODE -ne 0){throw 'Synthetic fixture grants failed'}
docker run -d --name $api --network $net -p "127.0.0.1:${port}:3000" -e PGRST_DB_URI=postgres://postgres@checkpoint2-db/postgres -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET=synthetic-test-secret-with-at-least-32-bytes-only public.ecr.aws/supabase/postgrest:v16.5 | Out-Null
if($LASTEXITCODE -ne 0){throw 'PostgREST start failed'}
docker network connect bridge $api
if($LASTEXITCODE -ne 0){throw 'PostgREST bridge failed'}
$env:ALS_REGISTRATION_RACE_LAB='1'; $env:ALS_REGISTRATION_RACE_CONTAINER=$db; $env:ALS_REGISTRATION_RACE_API="http://127.0.0.1:$port"
pnpm exec vitest run src/app/api/auth/setup/registration-race.lab.test.ts --reporter=verbose
if($LASTEXITCODE -ne 0){throw 'Route tests failed'}
'PASS: exact migration union in timestamp order with synthetic Postgres/PostgREST. Auth calls are simulated.'

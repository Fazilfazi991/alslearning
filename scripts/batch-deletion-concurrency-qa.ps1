<#
Run only against a disposable, fully migrated local PostgreSQL database.
Preseed one unreferenced synthetic batch (slug batch-guard-concurrency-*) and
one synthetic Teacher (@example.invalid). Both must belong to this database.
Set the database comment to als-batch-guard:<Marker GUID> during provisioning.
The script commits one synthetic child link, verifies FK rejection, then removes
that exact link. All other writes roll back. Never run against a shared stack.
This checks FK concurrency, not application authorization or RLS.
#>
param(
  [Parameter(Mandatory = $true)][string]$PsqlPath,
  [Parameter(Mandatory = $true)][ValidateSet('localhost', '127.0.0.1')][string]$HostName,
  [Parameter(Mandatory = $true)][ValidateRange(1024, 65535)][int]$Port,
  [Parameter(Mandatory = $true)][ValidatePattern('^als_batch_guard_[0-9]+$')][string]$Database,
  [Parameter(Mandatory = $true)][guid]$Marker,
  [Parameter(Mandatory = $true)][guid]$BatchId,
  [Parameter(Mandatory = $true)][guid]$FacultyId,
  [string]$Username = 'postgres'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not [System.IO.Path]::IsPathFullyQualified($PsqlPath) -or
    -not (Test-Path -LiteralPath $PsqlPath -PathType Leaf)) {
  throw 'PsqlPath must be an existing absolute path to psql.'
}
$psqlExecutable = (Resolve-Path -LiteralPath $PsqlPath).Path
$batch = $BatchId.ToString()
$faculty = $FacultyId.ToString()
$expectedMarker = 'als-batch-guard:' + $Marker.ToString()

function Start-PsqlSession {
  $info = [System.Diagnostics.ProcessStartInfo]::new()
  $info.FileName = $psqlExecutable
  foreach ($arg in @('-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-P', 'pager=off',
      '-h', $HostName, '-p', [string]$Port, '-d', $Database, '-U', $Username)) {
    [void]$info.ArgumentList.Add($arg)
  }
  $info.UseShellExecute = $false
  $info.RedirectStandardInput = $true
  $info.RedirectStandardOutput = $true
  $info.CreateNoWindow = $true
  $process = [System.Diagnostics.Process]::Start($info)
  if ($null -eq $process) { throw 'Could not start psql.' }
  $session = [pscustomobject]@{ Process = $process; Input = $process.StandardInput;
    Output = $process.StandardOutput; BackendPid = 0 }
  $session.BackendPid = [int](Invoke-SessionQuery $session 'select pg_backend_pid();')
  return $session
}

function Send-Sql($session, [string]$sql) {
  if ($session.Process.HasExited) { throw 'psql session exited unexpectedly.' }
  $session.Input.WriteLine($sql)
  $session.Input.Flush()
}

function Read-Result($session) {
  $task = $session.Output.ReadLineAsync()
  $line = $task.WaitAsync([TimeSpan]::FromSeconds(20)).GetAwaiter().GetResult()
  if ($null -eq $line) { throw 'psql exited before returning a result.' }
  return $line.Trim()
}

function Invoke-SessionQuery($session, [string]$sql) {
  Send-Sql $session $sql
  return Read-Result $session
}

function Assert-Equals([string]$actual, [string]$expected, [string]$label) {
  if ($actual -ne $expected) { throw "$label`: expected '$expected', received '$actual'." }
}

function Wait-ForLock($observer, [int]$waitingPid) {
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    $state = Invoke-SessionQuery $observer "select coalesce(wait_event_type, 'none') from pg_stat_activity where pid = $waitingPid;"
    if ($state -eq 'Lock') { return }
    Start-Sleep -Milliseconds 100
  }
  throw "Backend $waitingPid did not wait on a lock; concurrency was not verified."
}

function Assert-FixtureState($observer) {
  $state = Invoke-SessionQuery $observer "select (select count(*) from public.batches where id = '$batch'::uuid)::text || ':' || (select count(*) from public.batch_faculty where batch_id = '$batch'::uuid and faculty_id = '$faculty'::uuid)::text;"
  Assert-Equals $state '1:0' 'Fixture state'
}

function Assert-LocalTarget($session) {
  $identity = Invoke-SessionQuery $session "select case when current_database() = '$Database' and shobj_description((select oid from pg_database where datname = current_database()), 'pg_database') = '$expectedMarker' then 'safe' else 'unsafe' end;"
  Assert-Equals $identity 'safe' 'Disposable database identity'
}

function Stop-PsqlSession($session) {
  if ($null -eq $session) { return }
  if (-not $session.Process.HasExited) {
    # Closing the connection rolls back any open transaction, including a blocked one.
    $session.Process.Kill($true)
    [void]$session.Process.WaitForExit(5000)
  }
  $session.Process.Dispose()
}

$sessionA = $null
$sessionB = $null
$observer = $null
$committedChildNeedsCleanup = $false
try {
  $sessionA = Start-PsqlSession
  $sessionB = Start-PsqlSession
  $observer = Start-PsqlSession
  Assert-LocalTarget $sessionA
  Assert-LocalTarget $sessionB
  Assert-LocalTarget $observer
  $fixture = Invoke-SessionQuery $sessionA "select case when exists (select 1 from public.batches where id = '$batch'::uuid and slug like 'batch-guard-concurrency-%') and exists (select 1 from public.profiles p join auth.users u on u.id = p.id where p.id = '$faculty'::uuid and p.role = 'teacher' and u.email like '%@example.invalid') then 'safe' else 'unsafe' end;"
  Assert-Equals $fixture 'safe' 'Synthetic fixture identity'
  $references = Invoke-SessionQuery $sessionA "select (select count(*) from public.batch_faculty where batch_id = '$batch'::uuid) + (select count(*) from public.enrollments where batch_id = '$batch'::uuid) + (select count(*) from public.content_batch_access where batch_id = '$batch'::uuid) + (select count(*) from public.test_batches where batch_id = '$batch'::uuid) + (select count(*) from public.live_sessions where batch_id = '$batch'::uuid);"
  Assert-Equals $references '0' 'Unreferenced synthetic batch'
  $constraints = Invoke-SessionQuery $sessionA "select count(*) from pg_constraint where contype = 'f' and confrelid = 'public.batches'::regclass and confdeltype = 'r' and not condeferrable;"
  Assert-Equals $constraints '5' 'Restrictive batch foreign keys'

  # An uncommitted child insert holds the parent key. A concurrent delete must wait.
  Assert-Equals (Invoke-SessionQuery $sessionA "begin; insert into public.batch_faculty(batch_id, faculty_id) values ('$batch'::uuid, '$faculty'::uuid); select 'insert-held';") 'insert-held' 'First insert'
  Send-Sql $sessionB "begin; set local statement_timeout = '15s'; delete from public.batches where id = '$batch'::uuid; select 'delete-finished';"
  Wait-ForLock $observer $sessionB.BackendPid
  Assert-Equals (Invoke-SessionQuery $sessionA "rollback; select 'insert-rolled-back';") 'insert-rolled-back' 'First rollback'
  Assert-Equals (Read-Result $sessionB) 'delete-finished' 'Delete after insert rollback'
  Assert-Equals (Invoke-SessionQuery $sessionB "rollback; select 'delete-rolled-back';") 'delete-rolled-back' 'Second rollback'
  Assert-FixtureState $sessionA

  # A concurrent child insert must wait while a delete holds the parent key.
  Assert-Equals (Invoke-SessionQuery $sessionB "begin; delete from public.batches where id = '$batch'::uuid; select 'delete-held';") 'delete-held' 'Second delete'
  Send-Sql $sessionA "begin; set local statement_timeout = '15s'; insert into public.batch_faculty(batch_id, faculty_id) values ('$batch'::uuid, '$faculty'::uuid); select 'insert-finished';"
  Wait-ForLock $observer $sessionA.BackendPid
  Assert-Equals (Invoke-SessionQuery $sessionB "rollback; select 'delete-rolled-back';") 'delete-rolled-back' 'Third rollback'
  Assert-Equals (Read-Result $sessionA) 'insert-finished' 'Insert after delete rollback'
  Assert-Equals (Invoke-SessionQuery $sessionA "rollback; select 'insert-rolled-back';") 'insert-rolled-back' 'Fourth rollback'
  Assert-FixtureState $sessionA

  # A committed child must make the waiting parent delete fail, leaving both rows.
  Assert-Equals (Invoke-SessionQuery $sessionA "begin; insert into public.batch_faculty(batch_id, faculty_id) values ('$batch'::uuid, '$faculty'::uuid); select 'insert-held';") 'insert-held' 'Committed insert setup'
  Send-Sql $sessionB "begin; set local statement_timeout = '15s'; do `$`$ declare observed_fk text; begin delete from public.batches where id = '$batch'::uuid; raise exception 'unexpected-delete-success'; exception when foreign_key_violation then get stacked diagnostics observed_fk = constraint_name; if observed_fk is distinct from 'batch_faculty_batch_id_fkey' then raise exception 'wrong-fk: %', observed_fk; end if; end `$`$; select 'fk-rejected';"
  Wait-ForLock $observer $sessionB.BackendPid
  $committedChildNeedsCleanup = $true
  Assert-Equals (Invoke-SessionQuery $sessionA "commit; select 'insert-committed';") 'insert-committed' 'Committed child insert'
  Assert-Equals (Read-Result $sessionB) 'fk-rejected' 'Delete after child commit'
  Assert-Equals (Invoke-SessionQuery $sessionB "rollback; select 'delete-rolled-back';") 'delete-rolled-back' 'Rejected delete rollback'
  Assert-Equals (Invoke-SessionQuery $sessionA "select (select count(*) from public.batches where id = '$batch'::uuid)::text || ':' || (select count(*) from public.batch_faculty where batch_id = '$batch'::uuid and faculty_id = '$faculty'::uuid)::text;") '1:1' 'Committed child and parent state'
  Assert-Equals (Invoke-SessionQuery $sessionA "begin; delete from public.batch_faculty where batch_id = '$batch'::uuid and faculty_id = '$faculty'::uuid; commit; select 'cleaned';") 'cleaned' 'Synthetic link cleanup'
  $committedChildNeedsCleanup = $false
  Assert-FixtureState $sessionA
  Write-Output 'Batch deletion concurrency checks passed (two rollback races and committed child rejection).'
}
finally {
  # Release any uncommitted row locks before fallback cleanup.
  Stop-PsqlSession $sessionA
  Stop-PsqlSession $sessionB
  Stop-PsqlSession $observer
  if ($committedChildNeedsCleanup) {
    try {
      # The link was absent at preflight and is owned by this script.
      $cleanupSession = Start-PsqlSession
      try {
        Assert-LocalTarget $cleanupSession
        Assert-Equals (Invoke-SessionQuery $cleanupSession "delete from public.batch_faculty where batch_id = '$batch'::uuid and faculty_id = '$faculty'::uuid; select 'cleaned';") 'cleaned' 'Fallback synthetic link cleanup'
      }
      finally { Stop-PsqlSession $cleanupSession }
    }
    catch { Write-Warning "Synthetic link cleanup failed: $($_.Exception.Message)" }
  }
}

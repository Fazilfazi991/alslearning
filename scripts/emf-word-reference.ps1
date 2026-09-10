# Render unmodified source documents with installed Word, read-only.
$ErrorActionPreference='Stop'
$word=New-Object -ComObject Word.Application
$word.Visible=$false
$word.DisplayAlerts=0
$pages=@()
$items=Get-Content -Raw docs/emf-source-inventory.json | ConvertFrom-Json
try {
  foreach($n in @(8,9,10)) {
    $file=Get-Item -Path "MOQ/app friendly format - JSO SIR $n - *.docx"
    $doc=$word.Documents.Open($file.FullName,$false,$true)
    try {
      $pdf=Join-Path (Get-Location) ".local-qa/emf/word-source-$n.pdf"
      $doc.ExportAsFixedFormat($pdf,17)
      $doc.Repaginate()
      $pictures=@($doc.InlineShapes | Where-Object {$_.Type -in @(3,4)})
      foreach($item in ($items | Where-Object {$_.source_document -eq $file.Name})) {
        $shape=$pictures[$item.inline_index-1]
        $pages+=[pscustomobject]@{source=$file.Name;filename=$item.original_filename;page=$shape.Range.Information(3);width=$shape.Width;height=$shape.Height;alt=$shape.AlternativeText;title=$shape.Title}
      }
      Write-Output "Rendered source $n with Word $($word.Version)"
    } finally {$doc.Close(0)}
  }
} finally {$word.Quit()}
$pages | ConvertTo-Json | Set-Content .local-qa/emf/source-pages.json

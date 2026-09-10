# Synthetic vector artwork only; no client/source content is uploaded for QA.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$bitmap=[Drawing.Bitmap]::new(600,300)
$reference=[Drawing.Graphics]::FromImage($bitmap)
$hdc=$reference.GetHdc()
try {$meta=[Drawing.Imaging.Metafile]::new((Join-Path (Get-Location) '.local-qa/synthetic-media.emf'),$hdc,[Drawing.Rectangle]::new(0,0,600,300),[Drawing.Imaging.MetafileFrameUnit]::Pixel)} finally {$reference.ReleaseHdc($hdc)}
$g=[Drawing.Graphics]::FromImage($meta)
$font=[Drawing.Font]::new('Arial',24)
$pen=[Drawing.Pen]::new([Drawing.Color]::Navy,4)
try {
 $g.Clear([Drawing.Color]::White)
 $g.DrawString('QA synthetic diagram',$font,[Drawing.Brushes]::Navy,20,20)
 $g.DrawRectangle($pen,20,90,200,130)
 $g.DrawEllipse($pen,350,90,130,130)
 $g.DrawLine($pen,230,155,340,155)
 $g.DrawString('A',$font,[Drawing.Brushes]::Black,100,130)
 $g.DrawString('B',$font,[Drawing.Brushes]::Black,395,130)
} finally {$g.Dispose();$font.Dispose();$pen.Dispose();$meta.Dispose();$reference.Dispose();$bitmap.Dispose()}
& "$PSScriptRoot/convert-emf.ps1" -InputPath .local-qa/synthetic-media.emf -OutputPath .local-qa/synthetic-media.png -PresentationJson '{"crop":{"l":0,"t":0,"r":0,"b":0},"extent_emu":{"cx":5486400,"cy":2743200}}'

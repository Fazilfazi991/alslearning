param([Parameter(Mandatory)][string]$InputPath, [Parameter(Mandatory)][string]$OutputPath, [string]$PresentationJson)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$source=(Resolve-Path -LiteralPath $InputPath).Path
$data=[IO.File]::ReadAllBytes($source)
if($data.Length -lt 88 -or [BitConverter]::ToUInt32($data,0) -ne 1 -or [BitConverter]::ToUInt32($data,40) -ne 1179469088){throw 'Not an enhanced metafile'}
$meta=[Drawing.Imaging.Metafile]::new($source)
try {
  $header=$meta.GetMetafileHeader()
  # Use the complete physical EMF frame at 600 DPI, without crop or fit-to-box.
  $width=[int][Math]::Ceiling(([BitConverter]::ToInt32($data,32)-[BitConverter]::ToInt32($data,24))*600/2540)
  $height=[int][Math]::Ceiling(([BitConverter]::ToInt32($data,36)-[BitConverter]::ToInt32($data,28))*600/2540)
  $crop=@{l=0;t=0;r=0;b=0}
  if($PresentationJson){
    $presentation=$PresentationJson | ConvertFrom-Json
    foreach($key in @('l','t','r','b')){ $crop[$key]=[double]$presentation.crop.$key; if($crop[$key] -lt 0 -or $crop[$key] -ge 100000){throw 'Unsupported source crop'} }
    if($crop.l+$crop.r -ge 100000 -or $crop.t+$crop.b -ge 100000){throw 'Invalid source crop'}
    # Exact authored DOCX presentation, 600 pixels per displayed inch. No inferred crop.
    $width=[int][Math]::Ceiling($presentation.extent_emu.cx*600/914400)
    $height=[int][Math]::Ceiling($presentation.extent_emu.cy*600/914400)
  }
  if($width -lt 1 -or $height -lt 1 -or [long]$width*$height -gt 150000000){throw 'Invalid or excessive EMF frame'}
  $bitmap=[Drawing.Bitmap]::new($width,$height,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $bitmap.SetResolution(600,600)
    $graphics=[Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([Drawing.Color]::White)
      $graphics.CompositingQuality=[Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($meta,[Drawing.Rectangle]::new(0,0,$width,$height),[single]($meta.Width*$crop.l/100000),[single]($meta.Height*$crop.t/100000),[single]($meta.Width*(100000-$crop.l-$crop.r)/100000),[single]($meta.Height*(100000-$crop.t-$crop.b)/100000),[Drawing.GraphicsUnit]::Pixel)
    } finally {$graphics.Dispose()}
    $bitmap.Save([IO.Path]::GetFullPath($OutputPath),[Drawing.Imaging.ImageFormat]::Png)
  } finally {$bitmap.Dispose()}
  [pscustomobject]@{width=$width;height=$height;format='image/png';conversion='windows-gdiplus-emf-docx-png-600dpi-white-v1';bytes=(Get-Item -LiteralPath $OutputPath).Length;sha256=(Get-FileHash -LiteralPath $OutputPath).Hash.ToLower()} | ConvertTo-Json -Compress
} finally {$meta.Dispose()}

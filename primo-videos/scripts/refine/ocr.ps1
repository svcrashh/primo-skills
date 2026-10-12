# OCR do Windows (Windows.Media.Ocr), o par do ocr.swift do Mac: uma linha JSON por imagem,
# {arquivo,w,h,linhas:[{texto,x,y,w,h}]}, em px da imagem com origem no topo. O contraste de cada linha o video.mjs
# mede depois, nos pixels. Roda no Windows PowerShell 5.1 (o pwsh 7 nao carrega os tipos do WinRT).
#   powershell -NoProfile -ExecutionPolicy Bypass -File ocr.ps1 <img.png> [<img.png> ...]
#   powershell -NoProfile -ExecutionPolicy Bypass -File ocr.ps1 --check     {"idioma":"en-US"} ou {"erro":"..."}
# A imagem e ampliada ate 2x antes da leitura: o OCR do Windows perde letra pequena que o Vision le.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
function Json($o) { [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 6)) }

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapTransform, Windows.Graphics, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics, ContentType = WindowsRuntime]
} catch {
  Json @{ erro = "the Windows OCR is not available here ($($_.Exception.Message))" }
  exit 0
}
$motor = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $motor) {
  Json @{ erro = 'no OCR language installed in Windows (Settings > Time & language > Language: add the language with its optical character recognition)' }
  exit 0
}
if ($args.Count -eq 1 -and $args[0] -eq '--check') {
  Json @{ idioma = $motor.RecognizerLanguage.LanguageTag; maximo = [Windows.Media.Ocr.OcrEngine]::MaxImageDimension }
  exit 0
}

$comoTarefa = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Espera($operacao, [Type]$tipo) {
  $tarefa = $comoTarefa.MakeGenericMethod($tipo).Invoke($null, @($operacao))
  $null = $tarefa.Wait(-1)
  $tarefa.Result
}

$maximo = [double][Windows.Media.Ocr.OcrEngine]::MaxImageDimension
foreach ($arq in $args) {
  $fs = $null
  try {
    $fs = [System.IO.File]::OpenRead($arq)
    $fluxo = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($fs)
    $dec = Espera ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($fluxo)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $W = [double]$dec.PixelWidth; $H = [double]$dec.PixelHeight
    $k = [Math]::Max(1.0, [Math]::Min(2.0, [Math]::Floor($maximo / [Math]::Max($W, $H) * 100) / 100))
    $tr = New-Object Windows.Graphics.Imaging.BitmapTransform
    $tr.ScaledWidth = [uint32][Math]::Round($W * $k)
    $tr.ScaledHeight = [uint32][Math]::Round($H * $k)
    $tr.InterpolationMode = [Windows.Graphics.Imaging.BitmapInterpolationMode]::Cubic
    $bmp = Espera ($dec.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied, $tr,
        [Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation, [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $res = Espera ($motor.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
    $linhas = @()
    foreach ($l in $res.Lines) {
      $x0 = [double]::MaxValue; $y0 = [double]::MaxValue; $x1 = 0.0; $y1 = 0.0
      foreach ($p in $l.Words) {
        $r = $p.BoundingRect
        $x0 = [Math]::Min($x0, $r.X); $y0 = [Math]::Min($y0, $r.Y)
        $x1 = [Math]::Max($x1, $r.X + $r.Width); $y1 = [Math]::Max($y1, $r.Y + $r.Height)
      }
      if ($x1 -le $x0) { continue }
      $linhas += [ordered]@{ texto = $l.Text; x = [Math]::Round($x0 / $k); y = [Math]::Round($y0 / $k); w = [Math]::Round(($x1 - $x0) / $k); h = [Math]::Round(($y1 - $y0) / $k) }
    }
    Json ([ordered]@{ arquivo = $arq; w = $W; h = $H; linhas = $linhas })
  } catch {
    Json ([ordered]@{ arquivo = $arq; erro = "$($_.Exception.Message)" })
  } finally {
    if ($fs) { $fs.Dispose() }
  }
}

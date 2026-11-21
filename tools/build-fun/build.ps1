# Build fun/index.html from the original claude.ai artifact HTML (KickKick football tests).
# Keeps the test content (questions, player data, photo list, CSS, JS) byte-for-byte,
# replaces only the claude.ai wrapper/head and the header markup, then applies the
# small string patches in replacements.json (each must match exactly once).
#
# Run (Windows PowerShell 5.1 or PowerShell 7):
#   powershell -ExecutionPolicy Bypass -File tools\build-fun\build.ps1
#   powershell -ExecutionPolicy Bypass -File tools\build-fun\build.ps1 -Src <artifact.html>
param(
  [string]$Src = (Join-Path $env:USERPROFILE '.claude\projects\C--Users-hanky-OneDrive-Desktop-FIFAGOSU\b0097744-b733-4dda-a245-c16a6d68dbf0\tool-results\artifact-9bdf29dc-1792762274-346d.html'),
  [string]$Out = ''
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent (Split-Path -Parent $here)
if (-not $Out) { $Out = Join-Path $repo 'fun\index.html' }
$utf8 = New-Object System.Text.UTF8Encoding($false)

$keep = Join-Path $here 'kickkick-original.html'
if (-not (Test-Path -LiteralPath $Src) -and (Test-Path -LiteralPath $keep)) { $Src = $keep }
if (-not (Test-Path -LiteralPath $Src)) { throw "source not found: $Src" }
# keep a copy of the original next to this script (the claude cache folder can be cleaned up)
if ((Resolve-Path -LiteralPath $Src).Path -ne $keep) { Copy-Item -LiteralPath $Src -Destination $keep -Force }
$raw = [IO.File]::ReadAllText($Src, [Text.Encoding]::UTF8)
$lines = @($raw -split "`n" | ForEach-Object { $_.TrimEnd("`r") })

# Expected layout of the artifact (1-based line numbers):
#   1-7    claude.ai wrapper + title/meta/fonts  -> replaced by part-head.html
#   8      <style>   (part-head.html ends with <style>)
#   9-136  page CSS ... </style>                 -> kept
#   137-149 body markup (header/ad/main/footer)  -> replaced by part-body.html
#   150-   <script> ... </script></body></html>  -> kept, then patched
function Expect($i, $text) {
  if ($lines[$i - 1] -ne $text) { throw "line $i is not '$text' (got '$($lines[$i - 1])'). Source layout changed; check build.ps1." }
}
Expect 8 '<style>'
Expect 136 '</style>'
Expect 150 '<script>'
if (-not ($lines -contains '</script>')) { throw 'closing </script> not found' }

$head = [IO.File]::ReadAllText((Join-Path $here 'part-head.html'), [Text.Encoding]::UTF8).TrimEnd()
$body = [IO.File]::ReadAllText((Join-Path $here 'part-body.html'), [Text.Encoding]::UTF8).TrimEnd()
$css  = $lines[8..135] -join "`n"
$rest = $lines[149..($lines.Count - 1)] -join "`n"
$html = $head + "`n" + $css + "`n" + $body + "`n`n" + $rest
if (-not $html.EndsWith("`n")) { $html += "`n" }

$reps = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $here 'replacements.json') | ConvertFrom-Json
foreach ($r in $reps) {
  $n = ([regex]::Matches($html, [regex]::Escape($r.from))).Count
  if ($n -ne 1) { throw "patch [$($r.id)] matched $n times (expected 1)" }
  $html = $html.Replace($r.from, $r.to)
  Write-Host "patched: $($r.id)"
}

if ($html.Contains('window.claude')) { throw 'window.claude is still referenced' }
if ($html.Contains('claude:viewport')) { throw 'claude meta is still present' }
if (([regex]::Matches($html, '<title>')).Count -ne 1) { throw 'expected exactly one <title>' }

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Out) | Out-Null
[IO.File]::WriteAllText($Out, $html, $utf8)
$size = (Get-Item -LiteralPath $Out).Length
Write-Host ("OK -> {0} ({1:N0} bytes, {2} lines)" -f $Out, $size, ($html -split "`n").Count)

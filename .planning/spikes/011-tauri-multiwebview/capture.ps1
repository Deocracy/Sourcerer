# Spike 011 capture — launch app detached, screenshot during + after the animation leg.
$ErrorActionPreference = "Continue"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

function Shot($path) {
  $vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap($vs.Width, $vs.Height)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($vs.X, $vs.Y, 0, 0, $bmp.Size)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "saved $path"
}

$before = (Get-Process msedgewebview2 -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Output "webview2_procs_before=$before"

$p = Start-Process -FilePath "$dir\target\debug\spike011-multiwebview.exe" -WorkingDirectory $dir -PassThru -RedirectStandardOutput "$dir\app-stdout.log" -RedirectStandardError "$dir\app-stderr.log"
Write-Output "launched pid=$($p.Id)"

Start-Sleep -Seconds 9          # pages load (t+6 orbit begins) -> mid-orbit
Shot "$dir\shot-during-anim.png"
$during = (Get-Process msedgewebview2 -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Output "webview2_procs_during=$during"

Start-Sleep -Seconds 8          # orbit (~2s) + pulse (~1s) done, settled
Shot "$dir\shot-after-settle.png"

if ($p.HasExited) { Write-Output "APP_EXITED code=$($p.ExitCode)" } else { Write-Output "APP_RUNNING (left open for live inspection)" }
Get-Content "$dir\app-stdout.log" -ErrorAction SilentlyContinue | Select-Object -Last 3

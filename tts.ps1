param(
  [Parameter(Position=0)][string]$TextFile = "text.txt",
  [Parameter(Position=1)][int]$Speaker = 1
)

if (-not (Test-Path $TextFile)) {
  Write-Host "usage: .\tts.ps1 <text_file> [speaker_id]"
  Write-Host "example: .\tts.ps1 text.txt 1"
  exit 1
}

# audio_query: URL に text と speaker を付ける（URL エンコード必須）
$txt = Get-Content -Raw $TextFile
$encoded = [uri]::EscapeDataString($txt)

$audioQueryUrl = "http://127.0.0.1:50021/audio_query?text=$encoded&speaker=$Speaker"
try {
  $resp = Invoke-RestMethod -Method Post -Uri $audioQueryUrl
  $resp | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 .\query.json
} catch {
  Write-Host "audio_query failed: $($_.Exception.Message)"
  exit 2
}

# JSON サイズ確認
$qsize = (Get-Item .\query.json).Length
if ($qsize -lt 200) {
  Write-Host "audio_query returned too small JSON ($qsize bytes). Likely error."
  Get-Content -Raw .\query.json | Write-Host
  exit 3
}

# synthesis
try {
  Invoke-WebRequest -Method Post `
    -ContentType "application/json" `
    -Uri "http://127.0.0.1:50021/synthesis?speaker=$Speaker&enable_interrogative_upspeak=true" `
    -InFile .\query.json -OutFile .\voice.wav
} catch {
  Write-Host "synthesis failed: $($_.Exception.Message)"
  exit 4
}

$wsize = (Get-Item .\voice.wav).Length
if ($wsize -lt 1000) {
  Write-Host "voice.wav too small ($wsize bytes). Something went wrong."
  exit 5
}

Write-Host "OK -> voice.wav ($wsize bytes)"

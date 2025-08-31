# ad-creator-ai

広告動画自動生成のスターター。**ブラウザを開かず**に、コマンドだけで VOICEVOX から WAV を出力する手順をまとめています。

## 前提
- Docker / Docker Compose がインストール済み
- このリポジトリ直下に `docker-compose.yml` があること（`ports: 127.0.0.1:50021:50021` 前提）

## 起動（ブラウザ不要）
```bash
docker compose up -d
docker compose ps
# STATUS が Up になればOK
```

## 使い方（コマンドだけで WAV 出力）

### A. Git Bash / WSL / Linux / macOS
```bash
# 1) 入力テキスト
echo -n "こんにちは。広告動画のテストです。" > text.txt

# 2) audio_query（JSON生成）
curl -s -X POST \
  "http://127.0.0.1:50021/audio_query?text=$(cat text.txt)&speaker=1" \
  > query.json

# 3) synthesis（WAV生成）
curl -s -H "Content-Type: application/json" \
  -X POST "http://127.0.0.1:50021/synthesis?speaker=1&enable_interrogative_upspeak=true" \
  -d @query.json > voice.wav

# 4) サイズ確認（0でなければOK）
wc -c voice.wav
```

### B. PowerShell（Windows ネイティブ）
```powershell
# 1) 入力テキスト
"こんにちは。広告動画のテストです。" | Out-File -Encoding utf8 -NoNewline .\text.txt

# 2) audio_query（JSON生成）
$txt = Get-Content -Raw .\text.txt
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:50021/audio_query?text=$([uri]::EscapeDataString($txt))&speaker=1" |
  ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 .\query.json

# 3) synthesis（WAV生成）
Invoke-WebRequest -Method Post `
  -ContentType "application/json" `
  -Uri "http://127.0.0.1:50021/synthesis?speaker=1&enable_interrogative_upspeak=true" `
  -InFile .\query.json -OutFile .\voice.wav

# 4) サイズ確認（0でなければOK）
(Get-Item .\voice.wav).Length
```

## よくある調整
- `speaker` : 声の種類（例: 1 = 四国めたん ノーマル）
- パラメータ調整は `query.json` の以下を編集  
  - `speedScale`（話速）, `intonationScale`（抑揚）, `volumeScale`（音量）, `outputSamplingRate`（サンプルレート）

スピーカー一覧の取得:
```bash
curl -s http://127.0.0.1:50021/speakers | jq
```

## ワンライナー（Git Bash / Linux / macOS）
```bash
echo -n "こんにちは。広告動画のテストです。" > text.txt && \
curl -s -X POST "http://127.0.0.1:50021/audio_query?text=$(cat text.txt)&speaker=1" | \
curl -s -H "Content-Type: application/json" -X POST \
"http://127.0.0.1:50021/synthesis?speaker=1&enable_interrogative_upspeak=true" \
-d @- > voice.wav && wc -c voice.wav
```

## トラブルシュート
- `docker compose ps` が `Restarting` の場合：`docker compose logs --tail 100` を確認  
- `exec: --: invalid option`：`docker-compose.yml` の `command` を削除する（公式既定に任せる）  
- `0 バイトの WAV`：`query.json` が空か、`synthesis` エラー。`curl` の URL/パラメータを再確認

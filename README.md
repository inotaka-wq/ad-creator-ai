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
# 0) スタイルIDを決める（例：ずんだもん/ノーマル = 3）
# 一覧を見る：curl -s http://127.0.0.1:50021/speakers #   | jq -r '.[] as $s | $s.styles[] | [$s.name, .name, (.id|tostring)] | @csv'
SID=3

# 1) 入力テキスト
echo -n "こんにちは。広告動画のテストです。" > text.txt

# 2) audio_query（JSON生成; POST + URLエンコード）
ENC_TEXT=$(python - <<'PY'
import urllib.parse,sys
print(urllib.parse.quote(open("text.txt","r",encoding="utf-8").read()))
PY
)
curl -s -X POST "http://127.0.0.1:50021/audio_query?text=$ENC_TEXT&speaker=$SID"   -H "accept: application/json" > query.json

# 3) synthesis（WAV生成）
curl -s -H "Content-Type: application/json"   -X POST "http://127.0.0.1:50021/synthesis?speaker=$SID&enable_interrogative_upspeak=true"   -d @query.json -o voice.wav

# 4) サイズ確認
wc -c voice.wav
```

### B. PowerShell（Windows ネイティブ）

```powershell
# 0) スタイルID（例：ずんだもん/ノーマル = 3）
$SID = 3

# 1) 入力テキスト
"こんにちは。広告動画のテストです。" | Out-File -Encoding utf8 -NoNewline .\text.txt

# 2) audio_query（JSON生成: POST + URLエンコード）
$txt = Get-Content -Raw .\text.txt
$enc = [uri]::EscapeDataString($txt)
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:50021/audio_query?text=$enc&speaker=$SID" |
  ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 .\query.json

# 3) synthesis（WAV生成）
Invoke-WebRequest -Method Post `
  -ContentType "application/json" `
  -Uri "http://127.0.0.1:50021/synthesis?speaker=$SID&enable_interrogative_upspeak=true" `
  -InFile .\query.json -OutFile .\voice.wav

# 4) サイズ確認
(Get-Item .\voice.wav).Length
```

## スピーカー一覧

```bash
curl -s http://127.0.0.1:50021/speakers | jq -r '.[] as $s | $s.styles[] | [$s.name, .name, (.id|tostring)] | @csv'
# 例出力: "ずんだもん","ノーマル","3"
# → この "3" を speaker= に使用
```

## ワンライナー（Git Bash / Linux / macOS）

```bash
SID=3; TEXT='テスト文'; ENC=$(python - <<'PY'
import urllib.parse;print(urllib.parse.quote("テスト文"))
PY
); curl -s -X POST "http://127.0.0.1:50021/audio_query?text=$ENC&speaker=$SID" | curl -s -H "Content-Type: application/json" -X POST   "http://127.0.0.1:50021/synthesis?speaker=$SID&enable_interrogative_upspeak=true"   -d @- -o voice.wav && wc -c voice.wav
```

## パラメータ調整（query.json を編集）

```bash
# 話速/音量/音高/抑揚の例
jq '.speedScale=0.95 | .volumeScale=1.1 | .pitchScale=0.1 | .intonationScale=1.2'   query.json > q.tmp && mv q.tmp query.json

# 語尾を疑問形っぽく
jq '.accent_phrases[-1].moras[-1].pitch += 0.8'   query.json > q.tmp && mv q.tmp query.json
```

## トラブルシュート

- {"detail":"Method Not Allowed"} → audio_query を GET している。必ず POST にする
- Invalid HTTP request → text を URL エンコードしていない
- 422 Unprocessable Entity → speaker が style_id でない / query.json が壊れている
- 0 バイトの WAV → query.json が空 / Content-Type ヘッダ忘れ

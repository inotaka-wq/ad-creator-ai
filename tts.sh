#!/usr/bin/env bash
# tts.sh: テキスト -> WAV（Git Bash / Linux / macOS）
# - URLエンコードの不備で 422 になる問題を修正
# - エラーハンドリングとサイズ検証を追加
set -euo pipefail

TEXT_FILE="${1:-text.txt}"
SPEAKER="${2:-1}"

if [ ! -f "$TEXT_FILE" ]; then
  echo "usage: $0 <text_file> [speaker_id]" >&2
  echo "example: $0 text.txt 1" >&2
  exit 1
fi

# audio_query: パラメータはURLに付ける（URLエンコード必須）
# -G でクエリ文字列化、--data-urlencode で安全にエンコード
HTTP_CODE=$(curl -sS -o query.json -w "%{http_code}" \
  -X POST -G "http://127.0.0.1:50021/audio_query" \
  --data-urlencode "text@${TEXT_FILE}" \
  --data-urlencode "speaker=${SPEAKER}")

if [ "$HTTP_CODE" != "200" ]; then
  echo "audio_query failed: HTTP $HTTP_CODE" >&2
  echo "---- response (query.json) ----" >&2
  head -200 query.json >&2 || true
  exit 2
fi

# JSON サイズ妥当性チェック（最低 200 バイト程度はある想定）
QSIZE=$(wc -c < query.json | tr -d ' ')
if [ "$QSIZE" -lt 200 ]; then
  echo "audio_query returned too small JSON ($QSIZE bytes). Likely error." >&2
  echo "---- response (query.json) ----" >&2
  cat query.json >&2
  exit 3
fi

# synthesis: JSON を送り、WAV を受け取る
HTTP_CODE=$(curl -sS -o voice.wav -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -X POST "http://127.0.0.1:50021/synthesis?speaker=${SPEAKER}&enable_interrogative_upspeak=true" \
  -d @query.json)

if [ "$HTTP_CODE" != "200" ]; then
  echo "synthesis failed: HTTP $HTTP_CODE" >&2
  echo "---- request preview (query.json head) ----" >&2
  head -50 query.json >&2 || true
  echo "---- response saved to voice.wav (may be JSON/HTML) ----" >&2
  file voice.wav 2>/dev/null || true
  exit 4
fi

WSIZE=$(wc -c < voice.wav | tr -d ' ')
if [ "$WSIZE" -lt 1000 ]; then
  echo "voice.wav too small ($WSIZE bytes). Something went wrong." >&2
  exit 5
fi

echo "OK -> voice.wav (${WSIZE} bytes)"

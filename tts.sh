#!/usr/bin/env bash
# tts.sh: テキスト -> WAV（Git Bash / Linux / macOS）
# - speaker: スタイルID もしくは 「話者名」「スタイル名」を指定可
# - 例) ./tts.sh text.txt 3
# - 例) ./tts.sh text.txt "ずんだもん" "ノーマル"
# - 例) ./tts.sh text.txt 3 out.wav
set -euo pipefail

TEXT_FILE="${1:-text.txt}"
ARG2="${2:-}"          # スタイルID または 話者名
ARG3="${3:-}"          # スタイル名 or 出力ファイル
OUT="${4:-voice.wav}"  # 出力ファイル（第4引数）

if [[ ! -f "$TEXT_FILE" ]]; then
  echo "usage:"
  echo "  $0 <text_file> <style_id> [out.wav]"
  echo "  $0 <text_file> <speaker_name> <style_name> [out.wav]"
  exit 1
fi

# 出力ファイル名の解釈（第2引数がIDのときだけ第3引数がout扱い）
if [[ -n "$ARG2" && -n "$ARG3" && "$ARG3" == *.wav && -z "${4-}" ]]; then
  OUT="$ARG3"
  ARG3=""
fi

# スタイルID解決
resolve_style_id() {
  local a2="$1" a3="$2"
  if [[ "$a2" =~ ^[0-9]+$ ]]; then
    echo "$a2"
    return 0
  fi
  # 話者名＋スタイル名からIDを解決（jq 必須）
  if ! command -v jq >/dev/null 2>&1; then
    echo "jq is required when using speaker/style names. Please install jq." >&2
    exit 2
  fi
  if [[ -z "$a3" ]]; then
    echo "When using names, provide both <speaker_name> and <style_name>." >&2
    exit 2
  fi
  curl -s http://127.0.0.1:50021/speakers \
  | jq -r --arg sp "$a2" --arg st "$a3" '
      .[] | select(.name==$sp) | .styles[] | select(.name==$st) | .id
    ' | head -n1
}

SID="$(resolve_style_id "$ARG2" "$ARG3")"
if [[ -z "$SID" ]]; then
  echo "Failed to resolve style id. Check speaker/style names or use a numeric style_id." >&2
  exit 2
fi

# audio_query（POST + URLエンコード）
HTTP_CODE=$(curl -sS -o query.json -w "%{http_code}" \
  -X POST -G "http://127.0.0.1:50021/audio_query" \
  --data-urlencode "text@${TEXT_FILE}" \
  --data-urlencode "speaker=${SID}" \
  -H "accept: application/json")

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "audio_query failed: HTTP $HTTP_CODE" >&2
  echo "---- response (query.json) ----" >&2
  head -200 query.json >&2 || true
  exit 3
fi

# JSON サイズ妥当性チェック
QSIZE=$(wc -c < query.json | tr -d ' ')
if [[ "$QSIZE" -lt 200 ]]; then
  echo "audio_query returned too small JSON ($QSIZE bytes). Likely error." >&2
  cat query.json >&2
  exit 4
fi

# ここで必要なら jq で調整例:
# jq '.speedScale=0.95 | .intonationScale=1.15' query.json > q.tmp && mv q.tmp query.json

# synthesis（JSON -> WAV）
HTTP_CODE=$(curl -sS -o "$OUT" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -X POST "http://127.0.0.1:50021/synthesis?speaker=${SID}&enable_interrogative_upspeak=true" \
  -d @query.json)

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "synthesis failed: HTTP $HTTP_CODE" >&2
  echo "---- request preview (query.json head) ----" >&2
  head -50 query.json >&2 || true
  echo "---- response saved to $OUT (may be JSON/HTML) ----" >&2
  exit 5
fi

WSIZE=$(wc -c < "$OUT" | tr -d ' ')
if [[ "$WSIZE" -lt 1000 ]]; then
  echo "$OUT too small ($WSIZE bytes). Something went wrong." >&2
  exit 6
fi

echo "OK -> $OUT (${WSIZE} bytes) [style_id=${SID}]"

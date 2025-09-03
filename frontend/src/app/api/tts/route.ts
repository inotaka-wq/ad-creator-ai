export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TTSBody = {
  text: string;
  engine: "voicevox" | "elevenlabs" | "coefont"; // 今は voicevox のみ実装
  preset?: "narration" | "genki" | "whisper";
  speed?: number; // 0.5-2.0
  speakerId?: string; // VoiceVox style_id
};

function toBase64(buf: ArrayBuffer) {
  const b = Buffer.from(buf);
  return b.toString("base64");
}

export async function POST(req: Request) {
  const body = (await req.json()) as TTSBody;
  const VOICEVOX = process.env.VOICEVOX_BASE ?? "http://127.0.0.1:50021";

  // 必須チェック
  const text = (body.text ?? "").trim();
  const speaker = String(body.speakerId ?? "3"); // 例: ずんだもん/ノーマル=3（README参照）
  if (!text) return new Response("text is required", { status: 400 });

  // 1) audio_query
  const enc = encodeURIComponent(text); // READMEのとおり「URLエンコード」が必須
  const qres = await fetch(
    `${VOICEVOX}/audio_query?text=${enc}&speaker=${speaker}`,
    {
      method: "POST",
      headers: { accept: "application/json" },
    }
  );
  if (!qres.ok) {
    const t = await qres.text();
    return new Response(`audio_query failed: ${t}`, { status: 500 });
  }
  const query = await qres.json();

  // 速度などの軽調整（任意）
  if (body.speed) query.speedScale = Math.max(0.5, Math.min(body.speed, 2.0));

  // 2) synthesis
  const sres = await fetch(
    `${VOICEVOX}/synthesis?speaker=${speaker}&enable_interrogative_upspeak=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    }
  );
  if (!sres.ok) {
    const t = await sres.text();
    return new Response(`synthesis failed: ${t}`, { status: 500 });
  }
  const wav = await sres.arrayBuffer();

  // フロントは data URL を受け取って <audio src=...> で再生
  const dataUrl = `data:audio/wav;base64,${toBase64(wav)}`;
  return Response.json({ audioUrl: dataUrl });
}

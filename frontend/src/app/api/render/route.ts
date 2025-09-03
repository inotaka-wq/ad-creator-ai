import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { createWriteStream, promises as fsp } from "fs";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

ffmpeg.setFfmpegPath(ffmpegPath!);

async function writeBuffer(p: string, data: Buffer | ArrayBuffer) {
  const b = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
  await fsp.writeFile(p, b);
  return p;
}

function toBase64(buf: Buffer) {
  return buf.toString("base64");
}

export async function POST(req: Request) {
  // 画像は multipart(file) または JSON の imageUrl
  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await req.formData();
    const image = form.get("image") as File | null;
    const audioUrl = String(form.get("audioUrl") ?? "");
    if (!image || !audioUrl)
      return new Response("image and audioUrl required", { status: 400 });
    return await renderFromParts(image, audioUrl);
  } else {
    const { imageUrl, audioUrl } = (await req.json()) as {
      imageUrl?: string;
      audioUrl?: string;
    };
    if (!imageUrl || !audioUrl)
      return new Response("imageUrl and audioUrl required", { status: 400 });
    return await renderFromUrls(imageUrl, audioUrl);
  }
}

async function renderFromParts(image: File, audioUrl: string) {
  const id = randomUUID();
  const dir = join(tmpdir(), `ad-${id}`);
  await fsp.mkdir(dir, { recursive: true });
  const imgPath = join(dir, "image.png");
  const wavPath = join(dir, "audio.wav");
  const mp4Path = join(dir, "out.mp4");

  const imgBuf = Buffer.from(await image.arrayBuffer());
  await writeBuffer(imgPath, imgBuf);

  const wavBuf = await dataUrlToBuffer(audioUrl);
  await writeBuffer(wavPath, wavBuf);

  await ffmpegStillToMp4(imgPath, wavPath, mp4Path);

  const mp4 = await fsp.readFile(mp4Path);
  await fsp.rm(dir, { recursive: true, force: true });
  return Response.json({ videoUrl: `data:video/mp4;base64,${toBase64(mp4)}` });
}

async function renderFromUrls(imageUrl: string, audioUrl: string) {
  // imageUrl は http(s) か data URL を受け付ける
  const id = randomUUID();
  const dir = join(tmpdir(), `ad-${id}`);
  await fsp.mkdir(dir, { recursive: true });
  const imgPath = join(dir, "image");
  const wavPath = join(dir, "audio.wav");
  const mp4Path = join(dir, "out.mp4");

  // 画像ロード
  const imgBuf = await loadToBuffer(imageUrl);
  await writeBuffer(imgPath, imgBuf);

  // 音声ロード（data URL 前提。必要なら http(s) も対応可）
  const wavBuf = await dataUrlToBuffer(audioUrl);
  await writeBuffer(wavPath, wavBuf);

  await ffmpegStillToMp4(imgPath, wavPath, mp4Path);

  const mp4 = await fsp.readFile(mp4Path);
  await fsp.rm(dir, { recursive: true, force: true });
  return Response.json({ videoUrl: `data:video/mp4;base64,${toBase64(mp4)}` });
}

async function dataUrlToBuffer(u: string) {
  if (!u.startsWith("data:")) {
    // 将来的に /api/tts をバイナリ返却にする場合などはここに fetch を足す
    throw new Error("audioUrl must be data URL in MVP");
  }
  const base64 = u.substring(u.indexOf(",") + 1);
  return Buffer.from(base64, "base64");
}

async function loadToBuffer(u: string) {
  if (u.startsWith("data:")) {
    const base64 = u.substring(u.indexOf(",") + 1);
    return Buffer.from(base64, "base64");
  }
  const res = await fetch(u);
  if (!res.ok) throw new Error(`failed to fetch image: ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function ffmpegStillToMp4(
  imagePath: string,
  wavPath: string,
  outPath: string
) {
  // 1枚画像を音声の長さに合わせて動画化（H.264 + AAC）
  // -loop 1 で静止画ループ、-shortest で音声に合わせて終了
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .addInput(imagePath)
      .inputOptions(["-loop 1"])
      .addInput(wavPath)
      .outputOptions([
        "-c:v libx264",
        "-tune stillimage",
        "-c:a aac",
        "-b:a 192k",
        "-pix_fmt yuv420p",
        "-shortest",
        "-movflags +faststart",
        "-vf scale=1280:-2", // 1280x(アスペクト維持)
      ])
      .save(outPath)
      .on("end", () => resolve())
      .on("error", (e) => reject(e));
  });
}

"use client";
import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  Wand2,
  Play,
  Pause,
  Download,
  ImageIcon,
  Settings2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

// --- Helper types
interface TTSRequest {
  text: string;
  engine: "voicevox" | "elevenlabs" | "coefont";
  preset: "narration" | "genki" | "whisper";
  speed: number; // 0.5 - 2.0
  speakerId?: string; // for VoiceVox etc.
}

export default function AdVideoMVP() {
  // --- UI state
  const [text, setText] =
    useState<string>("こんにちは。広告動画のテストです。");
  const [engine, setEngine] = useState<TTSRequest["engine"]>("voicevox");
  const [preset, setPreset] = useState<TTSRequest["preset"]>("narration");
  const [speed, setSpeed] = useState<number>(1.0);
  const [speakerId, setSpeakerId] = useState<string>("1");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");

  const [audioUrl, setAudioUrl] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [isRenderingVideo, setIsRenderingVideo] = useState<boolean>(false);
  const [playing, setPlaying] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasImage = useMemo(
    () => !!imageFile || !!imageUrl,
    [imageFile, imageUrl]
  );

  // --- Handlers
  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setImageFile(f);
      setImageUrl("");
    }
  };

  const onGenerateAudio = async () => {
    setIsGeneratingAudio(true);
    setAudioUrl("");
    try {
      // NOTE: Backend endpoint to be implemented separately
      // Expected to return { audioUrl: string }
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          engine,
          preset,
          speed,
          speakerId,
        } satisfies TTSRequest),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setAudioUrl(json.audioUrl);
    } catch (err) {
      console.error(err);
      alert(
        "音声生成に失敗しました。バックエンド /api/tts を確認してください。"
      );
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const onRenderVideo = async () => {
    if (!audioUrl || !hasImage) {
      alert("画像と音声を用意してください。");
      return;
    }
    setIsRenderingVideo(true);
    setVideoUrl("");

    try {
      let imagePayload: { imageUrl?: string } | FormData;
      let headers: Record<string, string> | undefined = undefined;

      if (imageFile) {
        const fd = new FormData();
        fd.append("image", imageFile);
        fd.append("audioUrl", audioUrl);
        imagePayload = fd; // multipart
      } else {
        imagePayload = { imageUrl, audioUrl };
        headers = { "Content-Type": "application/json" };
      }

      const res = await fetch("/api/render", {
        method: "POST",
        headers,
        body:
          imagePayload instanceof FormData
            ? imagePayload
            : JSON.stringify(imagePayload),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setVideoUrl(json.videoUrl);
    } catch (err) {
      console.error(err);
      alert(
        "動画レンダリングに失敗しました。バックエンド /api/render を確認してください。"
      );
    } finally {
      setIsRenderingVideo(false);
    }
  };

  const onPlayPause = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play();
      setPlaying(true);
      a.onended = () => setPlaying(false);
    }
  };

  // --- UI blocks
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold tracking-tight"
          >
            🎬 AI広告動画生成 — MVP v1（1枚画像＋音声）
          </motion.h1>
          <div className="text-xs text-gray-500">
            v1 → v2（複数スライド）へ拡張予定
          </div>
        </header>

        {/* Stepper */}
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { title: "1. ナレーション", desc: "テキストと音声プリセット" },
            { title: "2. 画像", desc: "アップロード or URL" },
            { title: "3. 合成", desc: "FFmpegで動画出力" },
          ].map((s, i) => (
            <Card key={i} className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600">
                {s.desc}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
          {/* Left: Text & TTS */}
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                ナレーション
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="text">テキスト</Label>
                <Textarea
                  id="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="mt-1 min-h-[160px]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label>エンジン</Label>
                  <Select
                    value={engine}
                    onValueChange={(v) => setEngine(v as any)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="voicevox">
                        VOICEVOX（ローカル）
                      </SelectItem>
                      <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                      <SelectItem value="coefont">CoeFont</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>プリセット</Label>
                  <Select
                    value={preset}
                    onValueChange={(v) => setPreset(v as any)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="narration">ナレーション</SelectItem>
                      <SelectItem value="genki">元気</SelectItem>
                      <SelectItem value="whisper">ささやき</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>話速: {speed.toFixed(2)}x</Label>
                  <Slider
                    defaultValue={[1]}
                    min={0.5}
                    max={2}
                    step={0.05}
                    onValueChange={(v) => setSpeed(v[0])}
                    className="mt-4"
                  />
                </div>
              </div>

              {engine === "voicevox" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="speaker">VOICEVOX Speaker ID</Label>
                    <Input
                      id="speaker"
                      value={speakerId}
                      onChange={(e) => setSpeakerId(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={onGenerateAudio}
                      disabled={isGeneratingAudio}
                      className="w-full"
                    >
                      {isGeneratingAudio ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="mr-2 h-4 w-4" />
                      )}
                      音声生成
                    </Button>
                  </div>
                </div>
              )}

              {engine !== "voicevox" && (
                <div className="flex justify-end">
                  <Button
                    onClick={onGenerateAudio}
                    disabled={isGeneratingAudio}
                  >
                    {isGeneratingAudio ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    音声生成
                  </Button>
                </div>
              )}

              {/* Audio Preview */}
              <div className="rounded-xl border p-3">
                <div className="mb-2 text-sm text-gray-600">プレビュー</div>
                {audioUrl ? (
                  <div className="flex items-center gap-3">
                    <audio ref={audioRef} src={audioUrl} preload="metadata" />
                    <Button variant="outline" size="sm" onClick={onPlayPause}>
                      {playing ? (
                        <Pause className="mr-1 h-4 w-4" />
                      ) : (
                        <Play className="mr-1 h-4 w-4" />
                      )}
                      {playing ? "一時停止" : "再生"}
                    </Button>
                    <a href={audioUrl} download className="text-sm underline">
                      音声を保存
                    </a>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">
                    まだ音声がありません
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: Image & Render */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                画像 & 合成
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label htmlFor="image">画像アップロード</Label>
                  <div className="mt-1 flex items-center gap-3">
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={onPickFile}
                    />
                    <span className="text-xs text-gray-500">または</span>
                    <Input
                      placeholder="画像URL"
                      value={imageUrl}
                      onChange={(e) => {
                        setImageUrl(e.target.value);
                        setImageFile(null);
                      }}
                    />
                  </div>
                </div>

                {/* Image preview */}
                <div className="overflow-hidden rounded-xl border">
                  {hasImage ? (
                    <div className="aspect-video w-full bg-gray-50">
                      {imageFile ? (
                        <img
                          className="h-full w-full object-cover"
                          src={URL.createObjectURL(imageFile)}
                          alt="preview"
                        />
                      ) : (
                        <img
                          className="h-full w-full object-cover"
                          src={imageUrl}
                          alt="preview"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-gray-50 text-sm text-gray-400">
                      画像が未選択です
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    className="grow"
                    onClick={onRenderVideo}
                    disabled={isRenderingVideo || !audioUrl || !hasImage}
                  >
                    {isRenderingVideo ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Settings2 className="mr-2 h-4 w-4" />
                    )}
                    動画を合成（音声＋画像）
                  </Button>
                </div>

                {/* Video preview */}
                <div className="rounded-xl border p-3">
                  <div className="mb-2 text-sm text-gray-600">
                    出力プレビュー
                  </div>
                  {videoUrl ? (
                    <div className="space-y-2">
                      <video
                        className="aspect-video w-full"
                        src={videoUrl}
                        controls
                      />
                      <div className="flex items-center gap-3">
                        <a
                          href={videoUrl}
                          download
                          className="inline-flex items-center text-sm underline"
                        >
                          <Download className="mr-1 h-4 w-4" />
                          MP4を保存
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">
                      まだ動画がありません
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer: Tips */}
        <div className="mt-8 text-xs text-gray-500">
          <p>バックエンド想定：</p>
          <ul className="list-inside list-disc">
            <li>
              <code>POST /api/tts</code> → <code>{`{ audioUrl: string }`}</code>{" "}
              を返す（VOICEVOXやElevenLabsへプロキシ）
            </li>
            <li>
              <code>POST /api/render</code> → 画像＋音声をFFmpegで合成し{" "}
              <code>{`{ videoUrl: string }`}</code> を返す
            </li>
          </ul>
          <p className="mt-2">
            v2
            での拡張予定：複数スライド（画像＋テキスト＋タイミング）、BGM合成、字幕（SRT自動生成）、テンプレート。
          </p>
        </div>
      </div>
    </div>
  );
}

import { NextResponse } from "next/server";
import ytdl from "ytdl-core";

type FormatType = "video+audio" | "video-only" | "audio-only";

type SerializableFormat = {
  itag: number;
  qualityLabel: string;
  container: string;
  mimeType: string;
  type: FormatType;
  hasAudio: boolean;
  hasVideo: boolean;
  fps: number | null;
  bitrate: number | null;
  sizeBytes: number | null;
};

type SerializableDetails = {
  title: string;
  author: string;
  lengthSeconds: number | null;
  thumbnailUrl: string;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getFormatType(format: ytdl.videoFormat): FormatType {
  if (format.hasVideo && format.hasAudio) {
    return "video+audio";
  }

  if (format.hasVideo) {
    return "video-only";
  }

  return "audio-only";
}

function toNumber(value: string | number | undefined | null): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normaliseAuthor(author: unknown): string {
  if (!author) {
    return "Unknown creator";
  }

  if (typeof author === "string") {
    return author;
  }

  if (typeof author === "object" && "name" in author && typeof (author as { name: unknown }).name === "string") {
    return (author as { name: string }).name;
  }

  if (typeof author === "object" && "user" in author && typeof (author as { user: unknown }).user === "string") {
    return (author as { user: string }).user;
  }

  return "Unknown creator";
}

function normaliseFormats(formats: ytdl.videoFormat[]): SerializableFormat[] {
  const serialisable = formats
    .filter((format) => format.hasVideo || format.hasAudio)
    .map((format) => {
      const sizeBytes = toNumber(format.contentLength);
      const fallbackSize = (() => {
        const bitrate = toNumber(format.bitrate);
        const durationMs = toNumber(format.approxDurationMs);

        if (!bitrate || !durationMs) {
          return null;
        }

        const durationSeconds = durationMs / 1000;
        const bytes = (bitrate / 8) * durationSeconds;
        return Number.isFinite(bytes) ? Math.round(bytes) : null;
      })();

      return {
        itag: format.itag,
        qualityLabel: format.qualityLabel ?? "",
        container: format.container ?? "mp4",
        mimeType: format.mimeType ?? "",
        type: getFormatType(format),
        hasAudio: Boolean(format.hasAudio),
        hasVideo: Boolean(format.hasVideo),
        fps: toNumber(format.fps),
        bitrate: toNumber(format.bitrate),
        sizeBytes: sizeBytes ?? fallbackSize,
      } satisfies SerializableFormat;
    });

  const typePriority: Record<FormatType, number> = {
    "video+audio": 0,
    "video-only": 1,
    "audio-only": 2,
  };

  const resolutionFromLabel = (label: string): number => {
    const match = label.match(/(\d{3,4})p/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  return serialisable.sort((a, b) => {
    const typeDiff = typePriority[a.type] - typePriority[b.type];
    if (typeDiff !== 0) {
      return typeDiff;
    }

    const resolutionDiff = resolutionFromLabel(b.qualityLabel) - resolutionFromLabel(a.qualityLabel);
    if (resolutionDiff !== 0) {
      return resolutionDiff;
    }

    const fpsDiff = (b.fps ?? 0) - (a.fps ?? 0);
    if (fpsDiff !== 0) {
      return fpsDiff;
    }

    return (b.bitrate ?? 0) - (a.bitrate ?? 0);
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { url } = body as { url?: string };

    if (!url || typeof url !== "string" || !ytdl.validateURL(url)) {
      return NextResponse.json(
        { error: "Please provide a valid YouTube video URL." },
        { status: 400 }
      );
    }

    const info = await ytdl.getInfo(url);

    const thumbnails = info.videoDetails.thumbnails ?? [];
    const thumbnailUrl = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1]?.url ?? "" : "";
    const details: SerializableDetails = {
      title: info.videoDetails.title,
      author: normaliseAuthor(info.videoDetails.author),
      lengthSeconds: toNumber(info.videoDetails.lengthSeconds),
      thumbnailUrl,
    };

    const formats = normaliseFormats(info.formats);

    if (formats.length === 0) {
      return NextResponse.json(
        { error: "No downloadable formats were found for this video." },
        { status: 404 }
      );
    }

    return NextResponse.json({ details, formats });
  } catch (error) {
    console.error("Failed to load formats", error);
    return NextResponse.json(
      { error: "Unable to fetch video information right now. Please try again later." },
      { status: 500 }
    );
  }
}

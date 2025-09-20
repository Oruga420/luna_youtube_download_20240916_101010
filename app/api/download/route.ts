import { NextResponse } from "next/server";
import ytdl from "ytdl-core";

import {
  canonicaliseYoutubeUrl,
  createYtdlRequestOptions,
  mapYtdlError,
} from "../../../lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeFilename(input: string): string {
  return input.replace(/[\\/:*?"<>|]+/g, "").trim() || "youtube-video";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const itagParam = searchParams.get("itag");

    if (!url || !itagParam) {
      return NextResponse.json(
        { error: "A valid video URL and format must be provided." },
        { status: 400 }
      );
    }

    const canonical = canonicaliseYoutubeUrl(url);

    if (!canonical || !ytdl.validateURL(canonical.canonicalUrl)) {
      return NextResponse.json(
        { error: "A valid video URL and format must be provided." },
        { status: 400 }
      );
    }

    const itag = Number.parseInt(itagParam, 10);

    if (Number.isNaN(itag)) {
      return NextResponse.json(
        { error: "The selected format is invalid." },
        { status: 400 }
      );
    }

    const info = await ytdl.getInfo(canonical.canonicalUrl, createYtdlRequestOptions());
    const format = ytdl.chooseFormat(info.formats, { quality: itag });

    if (!format) {
      return NextResponse.json(
        { error: "The requested format is no longer available." },
        { status: 404 }
      );
    }

    const fileExtension = format.container ?? "mp4";
    const fileTitle = sanitizeFilename(info.videoDetails.title);
    const fileName = `${fileTitle}-${format.qualityLabel || `itag-${format.itag}`}.${fileExtension}`;
    const encodedFileName = encodeURIComponent(fileName);
    const mimeType = format.mimeType?.split(";")[0] ?? "application/octet-stream";

    const stream = ytdl(canonical.canonicalUrl, {
      ...createYtdlRequestOptions(),
      quality: itag,
    });

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        stream.on("data", (chunk) => {
          controller.enqueue(chunk);
        });

        stream.on("end", () => {
          controller.close();
        });

        stream.on("error", (error) => {
          console.error("Streaming error", error);
          controller.error(error);
        });
      },
      cancel() {
        stream.destroy();
      },
    });

    return new NextResponse(readable, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const mapped = mapYtdlError(error);
    console.error("Download failed", error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

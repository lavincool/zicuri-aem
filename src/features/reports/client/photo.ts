import {
  MAX_INPUT_PHOTO_BYTES,
  PHOTO_LONG_EDGE,
  type PhotoContentType,
  THUMB_LONG_EDGE,
} from "@/config/uploads";

export type ProcessedPhoto = {
  full: Blob;
  thumb: Blob;
  contentType: PhotoContentType;
  width: number;
  height: number;
  /** Dominant color, shown while the photo loads. */
  color: string;
  /** Object URL of the thumbnail for previews (revoke when done). */
  previewUrl: string;
};

export type ExifLocation = { lat: number; lng: number };

export class PhotoError extends Error {
  constructor(readonly code: "TOO_LARGE" | "UNSUPPORTED" | "FAILED") {
    super(code);
    this.name = "PhotoError";
  }
}

/** GPS from the original file, read before re-encoding strips all metadata. */
export async function readExifLocation(
  file: Blob,
): Promise<ExifLocation | null> {
  try {
    const { gps } = await import("exifr");
    const result = await gps(file);
    if (
      result &&
      Number.isFinite(result.latitude) &&
      Number.isFinite(result.longitude)
    ) {
      return { lat: result.latitude, lng: result.longitude };
    }
  } catch {
    // No EXIF or unreadable: fine, other location sources exist.
  }
  return null;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    // Browsers apply EXIF orientation to <img> by default.
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new PhotoError("UNSUPPORTED"));
    };
    image.src = url;
  });
}

function draw(
  image: HTMLImageElement,
  longEdge: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const scale = Math.min(
    1,
    longEdge / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoError("FAILED");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  return { canvas, width, height };
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function dominantColor(image: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) return "#5b6b5a";
  context.drawImage(image, 0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Resizes to a 1600 px long edge and re-encodes (WebP, or JPEG where the browser
 * can't encode WebP), plus a 480 px JPEG thumbnail. Re-encoding strips metadata.
 */
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  if (file.size > MAX_INPUT_PHOTO_BYTES) throw new PhotoError("TOO_LARGE");
  const image = await loadImage(file);

  const main = draw(image, PHOTO_LONG_EDGE);
  let full = await toBlob(main.canvas, "image/webp", 0.8);
  let contentType: PhotoContentType = "image/webp";
  if (full?.type !== "image/webp") {
    full = await toBlob(main.canvas, "image/jpeg", 0.82);
    contentType = "image/jpeg";
  }
  const small = draw(image, THUMB_LONG_EDGE);
  const thumb = await toBlob(small.canvas, "image/jpeg", 0.75);
  if (!full || !thumb) throw new PhotoError("FAILED");

  return {
    full,
    thumb,
    contentType,
    width: main.width,
    height: main.height,
    color: dominantColor(image),
    previewUrl: URL.createObjectURL(thumb),
  };
}

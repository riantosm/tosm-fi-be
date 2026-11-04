import crypto from "crypto";

// Cloudinary via its REST upload API (plain fetch + signed params) — same
// "no SDK" choice as utils/llm.ts and the Midtrans client. Every image lives
// under one root folder, one subfolder per domain: tosm-fi/wallet, later
// tosm-fi/instrument, etc.
const ROOT_FOLDER = "tosm-fi";

export type CloudinaryFolder = "wallet";

export type UploadImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export interface IUploadImage {
  mimeType: UploadImageMimeType;
  /** Base64 without the "data:...;base64," prefix. */
  data: string;
}

export interface IUploadedImage {
  url: string;
  publicId: string;
}

const IMAGE_MIME_TYPES: UploadImageMimeType[] = ["image/jpeg", "image/png", "image/webp"];
// ~1.5 MB of actual image. The frontend already resizes logos to 256px, so this
// is only a guard against a client that doesn't.
const MAX_IMAGE_BASE64 = 2 * 1024 * 1024;

const cloudName = () => process.env.CLOUDINARY_CLOUD_NAME ?? "";
const apiKey = () => process.env.CLOUDINARY_API_KEY ?? "";
const apiSecret = () => process.env.CLOUDINARY_API_SECRET ?? "";

const assertConfigured = () => {
  if (!cloudName() || !apiKey() || !apiSecret()) {
    throw new Error("Upload gambar belum dikonfigurasi");
  }
};

/** Returns a valid image payload, or undefined when the value is malformed or too large. */
export function sanitizeUploadImage(value: unknown): IUploadImage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { mimeType, data } = value as { mimeType?: unknown; data?: unknown };
  if (!IMAGE_MIME_TYPES.includes(mimeType as UploadImageMimeType)) return undefined;
  if (typeof data !== "string" || data.length === 0 || data.length > MAX_IMAGE_BASE64) {
    return undefined;
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return undefined;
  return { mimeType: mimeType as UploadImageMimeType, data };
}

/** Cloudinary signs the alphabetically sorted params (minus file/api_key) + the API secret with SHA1. */
const sign = (params: Record<string, string>) => {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(`${payload}${apiSecret()}`).digest("hex");
};

const callApi = async (
  action: "upload" | "destroy",
  params: Record<string, string>,
  file?: string
) => {
  const signed = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
  const body = new URLSearchParams({ ...signed, api_key: apiKey(), signature: sign(signed) });
  if (file) body.set("file", file);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName()}/image/${action}`, {
    method: "POST",
    body,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || `Cloudinary ${action} gagal (${res.status})`);
  }
  return json;
};

export const Cloudinary = {
  /**
   * Uploads to tosm-fi/<folder>/<name>. Re-uploading the same name overwrites
   * the old file (and purges the CDN cache), so replacing a logo never leaves
   * an orphan behind; the returned URL carries a new version, so clients
   * don't keep showing the cached old one either.
   */
  async upload(folder: CloudinaryFolder, name: string, image: IUploadImage): Promise<IUploadedImage> {
    assertConfigured();
    const json = await callApi(
      "upload",
      {
        folder: `${ROOT_FOLDER}/${folder}`,
        public_id: name,
        overwrite: "true",
        invalidate: "true",
      },
      `data:${image.mimeType};base64,${image.data}`
    ).catch((error) => {
      throw new Error(`Gagal mengunggah gambar: ${error.message}`);
    });
    return { url: json.secure_url, publicId: json.public_id };
  },

  async destroy(publicId: string): Promise<void> {
    assertConfigured();
    await callApi("destroy", { public_id: publicId, invalidate: "true" });
  },

  /** For cleanup after the owning document is already gone — a failure only leaves an orphan file. */
  async destroyQuietly(publicIds: (string | null | undefined)[]): Promise<void> {
    const ids = publicIds.filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;
    const results = await Promise.allSettled(ids.map((id) => Cloudinary.destroy(id)));
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.error(`⚠️ Cloudinary destroy failed for ${ids[i]}:`, result.reason);
      }
    });
  },
};

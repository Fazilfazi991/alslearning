import "server-only";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";

export const RECORDING_PART_SIZE = 8 * 1024 * 1024;
export const RECORDING_UPLOAD_URL_TTL_SECONDS = 15 * 60;
export const RECORDING_PLAYBACK_URL_TTL_SECONDS = 15 * 60;

export type RecordingChunk = { partNumber: number; byteLength: number; sha256: string; etag?: string };
export type MultipartUpload = {
  uploadId: string;
  objectKey: string;
  partSize: number;
  contentType: string;
};
export type UploadedPart = { partNumber: number; etag: string; byteLength: number | null };

export interface RecordingStorage {
  begin(sessionId: string, recordingId: string, segmentId: string, contentType: string): Promise<MultipartUpload>;
  signPart(upload: Pick<MultipartUpload, "uploadId" | "objectKey">, partNumber: number): Promise<{ url: string; expiresAt: string }>;
  listParts(upload: Pick<MultipartUpload, "uploadId" | "objectKey">): Promise<UploadedPart[]>;
  complete(upload: Pick<MultipartUpload, "uploadId" | "objectKey">, parts: { partNumber: number; etag: string }[]): Promise<{ objectKey: string; etag: string | null; byteLength: number }>;
  abort(upload: Pick<MultipartUpload, "uploadId" | "objectKey">): Promise<void>;
  verify(objectKey: string): Promise<{ etag: string | null; byteLength: number; contentType: string | null }>;
  digest(objectKey: string): Promise<{ sha256: string; byteLength: number }>;
  playbackUrl(objectKey: string): Promise<{ url: string; expiresAt: string }>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function recordingObjectKey(
  sessionId: string,
  recordingId: string,
  segmentId: string,
  contentType: string,
  startedAt = new Date(),
) {
  if (![sessionId, recordingId, segmentId].every(value => uuid.test(value))) throw new Error("Invalid recording scope");
  const extension = contentType.startsWith("video/mp4") ? "mp4" : contentType.startsWith("video/webm") ? "webm" : null;
  if (!extension) throw new Error("Unsupported recording content type");
  return `recordings/${startedAt.getUTCFullYear()}/${String(startedAt.getUTCMonth() + 1).padStart(2, "0")}/${sessionId}/${recordingId}/${segmentId}/teacher-composite.${extension}`;
}

export function r2Environment() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const missing = [
    !accountId && "R2_ACCOUNT_ID",
    !accessKeyId && "R2_ACCESS_KEY_ID",
    !secretAccessKey && "R2_SECRET_ACCESS_KEY",
    !bucket && "R2_BUCKET",
  ].filter(Boolean);
  if (missing.length) throw new Error(`R2 is not configured (${missing.join(", ")})`);
  return {
    accountId: accountId!, accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, bucket: bucket!,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

function createR2Client() {
  const environment = r2Environment();
  return {
    environment,
    client: new S3Client({
      region: "auto",
      endpoint: environment.endpoint,
      credentials: { accessKeyId: environment.accessKeyId, secretAccessKey: environment.secretAccessKey },
    }),
  };
}

function validPartNumber(partNumber: number) {
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) throw new Error("Invalid multipart part number");
}

export const r2RecordingStorage: RecordingStorage = {
  async begin(sessionId, recordingId, segmentId, contentType) {
    const { environment, client } = createR2Client();
    const objectKey = recordingObjectKey(sessionId, recordingId, segmentId, contentType);
    const response = await client.send(new CreateMultipartUploadCommand({
      Bucket: environment.bucket,
      Key: objectKey,
      ContentType: contentType,
      Metadata: { "als-session-id": sessionId, "als-recording-id": recordingId, "als-segment-id": segmentId },
    }));
    if (!response.UploadId) throw new Error("R2 did not return an upload ID");
    return { uploadId: response.UploadId, objectKey, partSize: RECORDING_PART_SIZE, contentType };
  },

  async signPart(upload, partNumber) {
    validPartNumber(partNumber);
    const { environment, client } = createR2Client();
    const url = await getSignedUrl(client, new UploadPartCommand({
      Bucket: environment.bucket,
      Key: upload.objectKey,
      UploadId: upload.uploadId,
      PartNumber: partNumber,
    }), { expiresIn: RECORDING_UPLOAD_URL_TTL_SECONDS });
    return { url, expiresAt: new Date(Date.now() + RECORDING_UPLOAD_URL_TTL_SECONDS * 1000).toISOString() };
  },

  async listParts(upload) {
    const { environment, client } = createR2Client();
    const parts: UploadedPart[] = [];
    let marker: string | undefined;
    do {
      const response = await client.send(new ListPartsCommand({
        Bucket: environment.bucket,
        Key: upload.objectKey,
        UploadId: upload.uploadId,
        PartNumberMarker: marker,
      }));
      for (const part of response.Parts || []) {
        if (part.PartNumber && part.ETag) parts.push({ partNumber: part.PartNumber, etag: part.ETag, byteLength: part.Size ?? null });
      }
      marker = response.IsTruncated ? response.NextPartNumberMarker : undefined;
    } while (marker);
    return parts.sort((a, b) => a.partNumber - b.partNumber);
  },

  async complete(upload, parts) {
    if (!parts.length || parts.length > 10_000) throw new Error("Multipart completion requires valid parts");
    const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    ordered.forEach((part, index) => {
      validPartNumber(part.partNumber);
      if (part.partNumber !== index + 1 || !part.etag) throw new Error("Multipart parts must be complete and ordered");
    });
    const { environment, client } = createR2Client();
    await client.send(new CompleteMultipartUploadCommand({
      Bucket: environment.bucket,
      Key: upload.objectKey,
      UploadId: upload.uploadId,
      MultipartUpload: { Parts: ordered.map(part => ({ PartNumber: part.partNumber, ETag: part.etag })) },
    }));
    const verified = await this.verify(upload.objectKey);
    return { objectKey: upload.objectKey, etag: verified.etag, byteLength: verified.byteLength };
  },

  async abort(upload) {
    const { environment, client } = createR2Client();
    await client.send(new AbortMultipartUploadCommand({
      Bucket: environment.bucket,
      Key: upload.objectKey,
      UploadId: upload.uploadId,
    }));
  },

  async verify(objectKey) {
    const { environment, client } = createR2Client();
    const response = await client.send(new HeadObjectCommand({ Bucket: environment.bucket, Key: objectKey }));
    if (typeof response.ContentLength !== "number" || response.ContentLength <= 0) throw new Error("R2 object is empty or unavailable");
    return { etag: response.ETag ?? null, byteLength: response.ContentLength, contentType: response.ContentType ?? null };
  },

  async digest(objectKey) {
    const { environment, client } = createR2Client();
    const response = await client.send(new GetObjectCommand({ Bucket: environment.bucket, Key: objectKey }));
    if (!response.Body) throw new Error("R2 object body is unavailable");
    const bytes = await response.Body.transformToByteArray();
    if (!bytes.byteLength) throw new Error("R2 object is empty");
    return { sha256: createHash("sha256").update(bytes).digest("hex"), byteLength: bytes.byteLength };
  },

  async playbackUrl(objectKey) {
    const { environment, client } = createR2Client();
    const url = await getSignedUrl(client, new GetObjectCommand({
      Bucket: environment.bucket,
      Key: objectKey,
      ResponseContentDisposition: "inline",
    }), { expiresIn: RECORDING_PLAYBACK_URL_TTL_SECONDS });
    return { url, expiresAt: new Date(Date.now() + RECORDING_PLAYBACK_URL_TTL_SECONDS * 1000).toISOString() };
  },
};

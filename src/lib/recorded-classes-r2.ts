import "server-only";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const RECORDED_CLASS_PLAYBACK_TTL_SECONDS = 4 * 60 * 60;
export const RECORDED_CLASS_UPLOAD_TTL_SECONDS = 30 * 60;
export const RECORDED_CLASS_PART_SIZE = 16 * 1024 * 1024;

export type R2Configuration = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

export function r2Configuration(): R2Configuration {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET;
  const endpoint = process.env.R2_ENDPOINT ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const missing = Object.entries({ accountId, accessKeyId, secretAccessKey, bucket, endpoint })
    .filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`R2 is not configured (${missing.join(", ")})`);
  return { accountId, accessKeyId, secretAccessKey, bucket, endpoint } as R2Configuration;
}

function client(configuration = r2Configuration()) {
  return new S3Client({
    region: "auto",
    endpoint: configuration.endpoint,
    credentials: { accessKeyId: configuration.accessKeyId, secretAccessKey: configuration.secretAccessKey },
  });
}

export function recordedClassObjectKey(recordingId: string, fileName = "video.mp4") {
  if (!/^[0-9a-f-]{36}$/i.test(recordingId)) throw new Error("Invalid recording ID");
  const safeName = fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "video.mp4";
  return `recorded-classes/${recordingId}/${crypto.randomUUID()}/${safeName}`;
}

export async function getRecordedClassPlaybackUrl(key: string) {
  const config = r2Configuration();
  const url = await getSignedUrl(client(config), new GetObjectCommand({ Bucket: config.bucket, Key: key }), { expiresIn: RECORDED_CLASS_PLAYBACK_TTL_SECONDS });
  return { url, expiresAt: new Date(Date.now() + RECORDED_CLASS_PLAYBACK_TTL_SECONDS * 1000).toISOString() };
}

export async function getRecordedClassMetadata(key: string) {
  const config = r2Configuration();
  return client(config).send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
}

export async function deleteRecordedClassVideo(key: string) {
  const config = r2Configuration();
  await client(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

export async function beginRecordedClassUpload(recordingId: string, fileName: string, contentType: string) {
  if (contentType !== "video/mp4") throw new Error("Only MP4 video is supported");
  const config = r2Configuration();
  const objectKey = recordedClassObjectKey(recordingId, fileName);
  const result = await client(config).send(new CreateMultipartUploadCommand({ Bucket: config.bucket, Key: objectKey, ContentType: contentType }));
  if (!result.UploadId) throw new Error("R2 did not create an upload session");
  return { uploadId: result.UploadId, objectKey, partSize: RECORDED_CLASS_PART_SIZE };
}

export async function signRecordedClassUploadPart(objectKey: string, uploadId: string, partNumber: number) {
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) throw new Error("Invalid upload part");
  const config = r2Configuration();
  return getSignedUrl(client(config), new UploadPartCommand({ Bucket: config.bucket, Key: objectKey, UploadId: uploadId, PartNumber: partNumber }), { expiresIn: RECORDED_CLASS_UPLOAD_TTL_SECONDS });
}

export async function completeRecordedClassUpload(objectKey: string, uploadId: string, parts: { partNumber: number; etag: string }[]) {
  const config = r2Configuration();
  await client(config).send(new CompleteMultipartUploadCommand({ Bucket: config.bucket, Key: objectKey, UploadId: uploadId, MultipartUpload: { Parts: parts.map(p => ({ PartNumber: p.partNumber, ETag: p.etag })) } }));
  return getRecordedClassMetadata(objectKey);
}

export async function abortRecordedClassUpload(objectKey: string, uploadId: string) {
  const config = r2Configuration();
  await client(config).send(new AbortMultipartUploadCommand({ Bucket: config.bucket, Key: objectKey, UploadId: uploadId }));
}

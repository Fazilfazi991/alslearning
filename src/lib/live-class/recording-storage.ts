import"server-only";
export type RecordingChunk={partNumber:number;byteLength:number;checksum?:string};
export type MultipartUpload={uploadId:string;objectKey:string;parts:RecordingChunk[]};
export interface RecordingStorage{begin(sessionId:string,recordingId:string,contentType:string):Promise<MultipartUpload>;signPart(upload:MultipartUpload,partNumber:number):Promise<{url:string;expiresAt:string}>;complete(upload:MultipartUpload,parts:{partNumber:number;etag:string}[]):Promise<{objectKey:string}>;abort(upload:MultipartUpload):Promise<void>}
export function recordingObjectKey(sessionId:string,recordingId:string,startedAt=new Date()){return `recordings/${startedAt.getUTCFullYear()}/${String(startedAt.getUTCMonth()+1).padStart(2,"0")}/${sessionId}/${recordingId}/teacher-composite.webm`}
export function r2Environment(){const values={accountId:process.env.R2_ACCOUNT_ID,accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY,bucket:process.env.R2_BUCKET};const missing=Object.entries(values).filter(([,value])=>!value).map(([key])=>key);if(missing.length)throw new Error(`R2 is not configured (${missing.join(", ")})`);return values as Record<keyof typeof values,string>}
// A concrete S3 adapter is deferred until credentials are approved. Browsers
// receive short-lived signed part URLs only and never receive R2 credentials.

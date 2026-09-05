export type LiveRoomRole="teacher"|"student"|"presenter";
export interface CreateRoomInput { sessionId:string; title:string; startsAt?:string; recordingEnabled:boolean }
export interface LiveRoom { providerRoomId:string; joinUrl:string; status:"scheduled"|"live"|"ended" }
export interface JoinToken { token:string; expiresAt:string; role:LiveRoomRole }
export interface RecordingEvent { providerRecordingId:string; sessionId:string; status:"recording"|"processing"|"ready"|"failed"; playbackUrl?:string; error?:string }

/** Implement this boundary with a production conferencing provider. Secrets stay in server-only adapters. */
export interface LiveClassProvider {
  createRoom(input:CreateRoomInput):Promise<LiveRoom>;
  closeRoom(providerRoomId:string):Promise<void>;
  createJoinToken(providerRoomId:string,userId:string,role:LiveRoomRole):Promise<JoinToken>;
  grantPresenter(providerRoomId:string,userId:string,granted:boolean):Promise<void>;
  startRecording(providerRoomId:string):Promise<{providerRecordingId:string}>;
  stopRecording(providerRoomId:string):Promise<void>;
  verifyWebhook(payload:string,signature:string):Promise<RecordingEvent>;
}

export function getLiveClassProvider():LiveClassProvider {
  throw new Error(`Live-class provider '${process.env.LIVE_CLASS_PROVIDER||"unconfigured"}' is not configured. Add a server-only adapter and credentials.`);
}

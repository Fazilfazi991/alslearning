import {describe,it,expect} from "vitest";
import {recordingReviewState} from "./recording-review-queue";
const base={status:"validating",rejected_at:null,client_validated_at:"2026-10-15",verified_at:null,asset_state:"ready",live_recording_segments:[{id:"s",status:"validating",total_bytes:100}]};
describe("recording review readiness",()=>{
  it("offers review only after Teacher evidence and nonempty complete assets",()=>expect(recordingReviewState(base)).toBe("Ready for review"));
  it.each([[],[{id:"s",status:"uploading",total_bytes:100}],[{id:"s",status:"validating",total_bytes:0}]].map(segments=>({segments})))("does not offer playback for unfinished or missing segments",({segments})=>expect(recordingReviewState({...base,live_recording_segments:segments})).toBe("Recording / processing"));
  it.each(["missing","unavailable"])("blocks an asset reported as %s",asset_state=>expect(recordingReviewState({...base,asset_state})).toContain("cannot publish"));
  it("does not treat a published flag as proof that an asset exists",()=>expect(recordingReviewState({...base,status:"published",live_recording_segments:[]})).toContain("cannot publish"));
  it("shows rejection independently of the supported capture status",()=>expect(recordingReviewState({...base,rejected_at:"2026-10-15"})).toBe("Rejected"));
  it.each(["failed","interrupted","aborted"])("shows %s as a failure requiring recovery",status=>expect(recordingReviewState({...base,status})).toContain("Failed"));
});

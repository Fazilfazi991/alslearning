import { describe, expect, it } from "vitest";
import { parseYouTubeInput, validateRecording, youtubeEmbedUrl, topicsForSubject, orderRecordings, type Recording } from "./recorded-classes";
import { clientRecordings } from "../../scripts/recorded-classes-client-content.mjs";
const id = "xNBduyugQSc";
describe("YouTube normalization", () => {
  it.each([id, `https://studio.youtube.com/video/${id}/edit?theme=dark`, `https://www.youtube.com/watch?v=${id}&t=4`, `https://youtu.be/${id}?si=123`, `https://youtube.com/embed/${id}`, `youtube.com/watch?v=${id}`, `https://m.youtube.com/watch?v=${id}`])("parses %s", input => expect(parseYouTubeInput(input)).toBe(id));
  it.each(["https://evil.example/watch?v="+id, "https://youtube.com.evil.example/watch?v="+id, "javascript:alert(1)", "not a video", "https://youtu.be/short", "https://youtube.com/watch?v=bad", `https://youtube.com@evil.example/watch?v=${id}`, `https://youtube.com/watch?v=${id}&v=${id}`, `https://youtu.be/${id}/extra`, `https://youtube.com:8080/watch?v=${id}`, `https://studio.youtube.com/video/${id}/other`])("rejects %s", input => expect(() => parseYouTubeInput(input)).toThrow());
  it("allows a missing link", () => expect(parseYouTubeInput(" ")).toBeNull());
  it("preserves a leading hyphen in IDs", () => expect(parseYouTubeInput("https://youtu.be/-oF7W3AvhmU")).toBe("-oF7W3AvhmU"));
  it("builds only an ID-based privacy embed", () => { expect(youtubeEmbedUrl(id)).toBe(`https://www.youtube-nocookie.com/embed/${id}`); expect(() => youtubeEmbedUrl("https://studio.youtube.com/video/"+id+"/edit")).toThrow(); });
});
describe("Recorded class authoring", () => {
  const base = {title:"Hemostasis",subject_id:"a",chapter_id:"b",status:"draft" as const,videoInput:"",sort_order:0};
  it("allows a link-pending Draft", () => expect(validateRecording(base)).toBeNull());
  it("rejects Published without a link", () => expect(() => validateRecording({...base,status:"published"})).toThrow("Draft"));
  it("rejects Archived without a link", () => expect(() => validateRecording({...base,status:"archived"})).toThrow("Draft"));
  it("allows Published with valid ID", () => expect(validateRecording({...base,status:"published",videoInput:id})).toBe(id));
  it("requires title and valid order", () => { expect(() => validateRecording({...base,title:" "})).toThrow(); expect(() => validateRecording({...base,sort_order:-1})).toThrow(); });
  it("scopes topics dynamically to Subject", () => expect(topicsForSubject([{id:"x",subject_id:"a",name:"A",display_order:0},{id:"y",subject_id:"b",name:"B",display_order:1}],"a").map(t => t.id)).toEqual(["x"]));
  it("orders previous/next consistently by topic, optional group and sort order", () => {
    const rows = [{id:"2",chapter_id:"a",subtopic:null,sort_order:2},{id:"1",chapter_id:"a",subtopic:null,sort_order:1},{id:"3",chapter_id:"b",subtopic:"CARBOHYDRATES",sort_order:0}] as Recording[];
    expect(orderRecordings(rows,[{id:"a",subject_id:"s",name:"A",display_order:0},{id:"b",subject_id:"s",name:"B",display_order:1}]).map(r => r.id)).toEqual(["1","2","3"]);
  });
  it("contains exactly the five client recordings and no invented Hemostasis link", () => {
    expect(clientRecordings).toHaveLength(5);
    expect(clientRecordings.find(r => r.title === "Hemostasis")?.videoId).toBeNull();
    expect(clientRecordings.filter(r => r.videoId)).toHaveLength(4);
    expect(clientRecordings[0].subtopic).toBe("CARBOHYDRATES");
    expect(new Set(clientRecordings.map(r => r.key)).size).toBe(5);
  });
});

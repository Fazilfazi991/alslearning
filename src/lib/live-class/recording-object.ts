// Object ownership is encoded by the server's upload path, never a browser URL.
export function recordingObjectBelongs(key:string,classId:string,recordingId:string,segmentId:string) {
  const match=/^recordings\/[0-9]{4}\/(?:0[1-9]|1[0-2])\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/teacher-composite\.(?:webm|mp4)$/i.exec(key);
  return !!match && match[1].toLowerCase()===classId.toLowerCase() && match[2].toLowerCase()===recordingId.toLowerCase() && match[3].toLowerCase()===segmentId.toLowerCase();
}

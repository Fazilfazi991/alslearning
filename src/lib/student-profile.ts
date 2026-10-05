export const profilePhotoLimit = 2 * 1024 * 1024;
export const profilePhotoTypes = ["image/jpeg", "image/png", "image/webp"];
export const validProfilePhone = (value: unknown): value is string => typeof value === "string" && value.length <= 32 && /^[0-9+(). -]*$/.test(value);
export function photoExtension(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (type === "image/png" && [137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value)) return "png";
  if (type === "image/webp" && new TextDecoder().decode(bytes.slice(0,4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8,12)) === "WEBP") return "webp";
  return null;
}
export type StudentPersonalProfile = { full_name: string; phone: string | null; photo_url: string | null };

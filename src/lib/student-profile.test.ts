import {describe,it,expect} from "vitest";
import {photoExtension,validProfilePhone} from "./student-profile";
describe("personal profile input",()=>{
  it("accepts optional international phone numbers and rejects markup",()=>{expect(validProfilePhone("+971 (50) 123-4567")).toBe(true);expect(validProfilePhone("")).toBe(true);expect(validProfilePhone("<script>" )).toBe(false);expect(validProfilePhone("1".repeat(33))).toBe(false)});
  it("checks photo content rather than trusting the declared MIME type",()=>{expect(photoExtension("image/png",new Uint8Array([137,80,78,71,13,10,26,10]))).toBe("png");expect(photoExtension("image/jpeg",new Uint8Array([255,216,255]))).toBe("jpg");expect(photoExtension("image/webp",new TextEncoder().encode("RIFF0000WEBP"))).toBe("webp");expect(photoExtension("image/png",new TextEncoder().encode("<svg></svg>"))).toBeNull();expect(photoExtension("image/svg+xml",new TextEncoder().encode("<svg></svg>"))).toBeNull()});
});

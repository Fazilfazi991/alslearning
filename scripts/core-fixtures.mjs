import { deflateSync } from "node:zlib";
function crc(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let n = 0; n < 8; n++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const tag = Buffer.from(type),
    size = Buffer.alloc(4),
    sum = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc(Buffer.concat([tag, data])));
  return Buffer.concat([size, tag, data, sum]);
}
const width = 320,
  height = 180,
  header = Buffer.alloc(13);
header.writeUInt32BE(width);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 2;
const pixels = Buffer.alloc(height * (width * 3 + 1));
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const at = y * (width * 3 + 1) + 1 + x * 3;
    pixels[at] = x < 160 ? 179 : 40;
    pixels[at + 1] = y < 90 ? 20 : 130;
    pixels[at + 2] = 120;
  }
export const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(pixels)),
  chunk("IEND", Buffer.alloc(0)),
]);
const stream = "BT /F1 18 Tf 35 140 Td (ALS Synthetic QA PDF) Tj ET";
const objects = [
  "<</Type/Catalog/Pages 2 0 R>>",
  "<</Type/Pages/Kids[3 0 R]/Count 1>>",
  "<</Type/Page/Parent 2 0 R/MediaBox[0 0 360 220]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
  `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
  "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
];
let document = "%PDF-1.4\n",
  offsets = [0];
objects.forEach((o, i) => {
  offsets.push(Buffer.byteLength(document));
  document += `${i + 1} 0 obj\n${o}\nendobj\n`;
});
const xref = Buffer.byteLength(document);
document +=
  "xref\n0 6\n0000000000 65535 f \n" +
  offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
    .join("") +
  `trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
export const pdf = Buffer.from(document);

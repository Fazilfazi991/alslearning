export type AcknowledgedPart = { partNumber: number; etag: string; byteLength: number; sha256: string };
export type ProviderPart = { partNumber: number; etag: string; byteLength: number | null };

export function validateMultipartCompletion(
  acknowledgements: AcknowledgedPart[],
  providerParts: ProviderPart[],
  partSize: number,
) {
  if (!acknowledgements.length || acknowledgements.length > 10_000) throw new Error("No complete multipart plan is available");
  const ordered = [...acknowledgements].sort((a, b) => a.partNumber - b.partNumber);
  const remote = [...providerParts].sort((a, b) => a.partNumber - b.partNumber);
  if (remote.length !== ordered.length) throw new Error("R2 part count does not match acknowledged parts");
  let totalBytes = 0;
  ordered.forEach((part, index) => {
    const expectedNumber = index + 1;
    if (part.partNumber !== expectedNumber || !part.etag || !/^[0-9a-f]{64}$/.test(part.sha256)) throw new Error("Recording parts must be contiguous and acknowledged");
    if (!Number.isSafeInteger(part.byteLength) || part.byteLength <= 0 || part.byteLength > partSize) throw new Error("Recording part size is invalid");
    if (index < ordered.length - 1 && part.byteLength !== partSize) throw new Error("Every non-final recording part must use the fixed part size");
    const actual = remote[index];
    if (actual.partNumber !== part.partNumber || actual.etag !== part.etag || (actual.byteLength !== null && actual.byteLength !== part.byteLength)) {
      throw new Error("R2 part state does not match the acknowledged recording data");
    }
    totalBytes += part.byteLength;
  });
  return { ordered, totalBytes };
}

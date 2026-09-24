export type AcknowledgedPart = { partNumber: number; etag: string; byteLength: number; sha256: string };
export type ProviderPart = { partNumber: number; etag: string; byteLength: number | null };
export type KnownPart = { partNumber: number; etag: string | null; byteLength: number; sha256: string };

export function reconcileMultipartState(knownParts: KnownPart[], providerParts: ProviderPart[]) {
  const known = new Map(knownParts.map(part => [part.partNumber, part]));
  if (known.size !== knownParts.length) throw new Error("Duplicate persisted recording part metadata");
  const recovered: { partNumber: number; etag: string }[] = [];
  const present = new Set<number>();
  for (const remote of providerParts) {
    const local = known.get(remote.partNumber);
    if (!local) throw new Error("R2 contains a part that was not signed from persisted recording bytes");
    if (remote.byteLength !== null && remote.byteLength !== local.byteLength) throw new Error("R2 part length does not match persisted recording bytes");
    if (local.etag && local.etag !== remote.etag) throw new Error("R2 part ETag does not match the acknowledged recording part");
    present.add(remote.partNumber);
    if (!local.etag) recovered.push({ partNumber: remote.partNumber, etag: remote.etag });
  }
  return {
    recovered,
    parts: [...knownParts].sort((a, b) => a.partNumber - b.partNumber).map(part => ({
      ...part,
      providerEtag: providerParts.find(remote => remote.partNumber === part.partNumber)?.etag || null,
      present: present.has(part.partNumber),
    })),
  };
}

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

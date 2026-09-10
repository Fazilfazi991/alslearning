import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { clients, ok } from "./pathology-client.mjs";
const { admin, root, fixture } = await clients();
const size = 20423184;
const path = `${fixture.users.admin.id}/media-capacity-${randomUUID()}/synthetic.emf`;
const bucket = ok(await root.storage.getBucket("question-media"));
assert.equal(bucket.public, false);
assert.ok(bucket.file_size_limit >= size);
assert.ok(bucket.allowed_mime_types.includes("image/x-emf"));
const bytes = Buffer.alloc(size, 0);
bytes.write("SYNTHETIC STORAGE CAPACITY FIXTURE - NOT CLIENT CONTENT");
try {
  ok(
    await admin.storage
      .from("question-media")
      .upload(path, bytes, { contentType: "image/x-emf" }),
  );
  console.log(
    "PASS: private storage accepts an original-sized synthetic fixture",
  );
} finally {
  ok(await root.storage.from("question-media").remove([path]));
}
assert.ok(
  (await admin.storage.from("question-media").createSignedUrl(path, 60)).error,
);
writeFileSync(
  "docs/media-capacity-verification.json",
  JSON.stringify(
    {
      public: false,
      limit: bucket.file_size_limit,
      largest_original_bytes: size,
      synthetic_upload_passed: true,
      synthetic_object_removed: true,
    },
    null,
    2,
  ) + "\n",
);

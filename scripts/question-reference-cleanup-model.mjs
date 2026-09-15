import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Source-specific approvals are keyed by the deterministic import identity and
// exact DOCX checksum. They never change the source key used to derive its ID.
const approvals = JSON.parse(readFileSync(new URL('./question-reference-cleanups.json',import.meta.url),'utf8'));
const byId = new Map(approvals.map(row=>[row.id,row]));
assert.equal(byId.size,approvals.length,'Duplicate source-reference cleanup identity');

export function displayStem(q,id,subject){
 const row=byId.get(id);
 if(!row)return {prompt:q.prompt,prompt_rich:q.prompt_rich};
 assert.equal(row.subject,subject,'Subject changed since source audit');
 assert.equal(row.source_document,q.source_document,'Original DOCX changed');
 assert.equal(row.source_sha256,q.source_sha256,'Original DOCX checksum changed');
 assert.equal(row.source_identity,q.source_key,'Source occurrence changed');
 assert.equal(row.source_sequence,q.source_sequence,'Question position changed');
 assert.equal(row.before,q.prompt,'Original parsed text changed');
 assert.deepEqual(row.before_rich,q.prompt_rich,'Original rich text changed');
 return {prompt:row.after,prompt_rich:row.after_rich};
}

export const confirmedSourceReferenceCount=approvals.length;

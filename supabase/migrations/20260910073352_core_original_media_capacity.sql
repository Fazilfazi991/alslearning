-- Largest inspected original is 20,423,184 bytes. Keep originals private and
-- bounded while allowing source preservation; never reduce an existing limit.
update storage.buckets set file_size_limit=33554432
 where id='question-media' and file_size_limit<33554432;

-- 017: stores can upload their own font (woff2, woff, ttf, otf) next to their images.
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct m) from unnest(allowed_mime_types || array['font/woff2','font/woff','font/ttf','font/otf']) m
)
where id = 'store-media';

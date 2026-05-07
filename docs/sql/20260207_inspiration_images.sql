-- =============================================================================
-- 灵感图片：inspirations.images + Storage bucket inspiration-images
-- 在 Supabase SQL Editor 中按需执行（或拆成多次执行）。
-- =============================================================================

-- 1) 表字段：最多 3 张，存公开 URL 字符串数组
ALTER TABLE public.inspirations
  ADD COLUMN IF NOT EXISTS images text[];

COMMENT ON COLUMN public.inspirations.images IS 'Supabase Storage 公开 URL，最多 3 张；NULL 或空数组表示无图';

-- 2) Storage Bucket（公开可读；大小与 MIME 在 Bucket 上限制）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspiration-images',
  'inspiration-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- 3) 清理旧策略（幂等，对象名与下面 CREATE 一致即可）
DROP POLICY IF EXISTS "inspiration_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "inspiration_images_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "inspiration_images_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "inspiration_images_auth_delete" ON storage.objects;

-- 任何人可读（SELECT）— 与「公开 Bucket」一致；若你希望仅登录用户可读，可改为 TO authenticated
CREATE POLICY "inspiration_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'inspiration-images');

-- 已登录用户可上传到「自己 user_id」为根目录的路径：{user_id}/{inspiration_id}/...
CREATE POLICY "inspiration_images_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'inspiration-images'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- 允许覆盖/元数据更新（可选）
CREATE POLICY "inspiration_images_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'inspiration-images'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'inspiration-images'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- 仅删除自己目录下文件
CREATE POLICY "inspiration_images_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'inspiration-images'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "Students can update own submission files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
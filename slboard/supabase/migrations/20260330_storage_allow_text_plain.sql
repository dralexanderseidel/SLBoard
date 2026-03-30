-- Erlaube text/plain im documents-Storage-Bucket
-- Hintergrund: Entwurfsassistent speichert die erste Version als .txt.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.oasis.opendocument.text',
  'text/plain'
]
where id = 'documents';


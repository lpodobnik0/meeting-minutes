-- Add language preference for remote endpoint transcription
ALTER TABLE transcript_settings ADD COLUMN remoteEndpointLanguage TEXT;

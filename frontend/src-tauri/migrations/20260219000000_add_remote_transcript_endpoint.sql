-- Add remote endpoint configuration to transcript_settings
ALTER TABLE transcript_settings ADD COLUMN remoteEndpointUrl TEXT;
ALTER TABLE transcript_settings ADD COLUMN remoteEndpointApiKey TEXT;

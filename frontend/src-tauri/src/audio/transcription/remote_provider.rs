// audio/transcription/remote_provider.rs
//
// Transcription provider that sends audio to a remote OpenAI-compatible REST endpoint.
// Encodes audio as WAV, POSTs multipart/form-data, parses {"text": "..."} response.

use super::provider::{TranscriptResult, TranscriptionError, TranscriptionProvider};
use async_trait::async_trait;
use log::{info, warn};
use reqwest::multipart;

// ============================================================================
// WAV ENCODING
// ============================================================================

/// Encode 16kHz mono f32 samples as a minimal PCM WAV file (no extra dependencies).
fn encode_wav(samples: &[f32]) -> Vec<u8> {
    let num_channels: u16 = 1;
    let sample_rate: u32 = 16000;
    let bits_per_sample: u16 = 16;
    let byte_rate = sample_rate * num_channels as u32 * bits_per_sample as u32 / 8;
    let block_align = num_channels * bits_per_sample / 8;
    let data_size = (samples.len() * 2) as u32; // 2 bytes per i16 sample
    let chunk_size = 36 + data_size;

    let mut buf = Vec::with_capacity(44 + samples.len() * 2);

    // RIFF header
    buf.extend_from_slice(b"RIFF");
    buf.extend_from_slice(&chunk_size.to_le_bytes());
    buf.extend_from_slice(b"WAVE");

    // fmt sub-chunk
    buf.extend_from_slice(b"fmt ");
    buf.extend_from_slice(&16u32.to_le_bytes()); // sub-chunk size
    buf.extend_from_slice(&1u16.to_le_bytes());  // PCM format
    buf.extend_from_slice(&num_channels.to_le_bytes());
    buf.extend_from_slice(&sample_rate.to_le_bytes());
    buf.extend_from_slice(&byte_rate.to_le_bytes());
    buf.extend_from_slice(&block_align.to_le_bytes());
    buf.extend_from_slice(&bits_per_sample.to_le_bytes());

    // data sub-chunk header
    buf.extend_from_slice(b"data");
    buf.extend_from_slice(&data_size.to_le_bytes());

    // PCM samples (f32 → i16, clamped)
    for &s in samples {
        let clamped = s.clamp(-1.0, 1.0);
        let pcm = (clamped * i16::MAX as f32) as i16;
        buf.extend_from_slice(&pcm.to_le_bytes());
    }

    buf
}

// ============================================================================
// REMOTE TRANSCRIPTION PROVIDER
// ============================================================================

/// Transcription provider that forwards audio to a remote OpenAI-compatible endpoint.
///
/// POST {endpoint_url}/v1/audio/transcriptions
///   Content-Type: multipart/form-data
///   Authorization: Bearer {api_key}   (omitted if api_key is None/empty)
///   Body fields:
///     file: audio.wav (WAV, 16kHz mono)
///     model: {model}
///     language: {language}  (omitted for auto-detect)
///     response_format: json
///
/// Expected response: {"text": "transcribed text here"}
pub struct RemoteTranscriptionProvider {
    endpoint_url: String,
    api_key: Option<String>,
    model: String,
    language: Option<String>,
    client: reqwest::Client,
}

impl RemoteTranscriptionProvider {
    pub fn new(endpoint_url: String, api_key: Option<String>, model: String, language: Option<String>) -> Self {
        // Strip trailing slash so we can append /v1/audio/transcriptions cleanly
        let endpoint_url = endpoint_url.trim_end_matches('/').to_string();
        Self {
            endpoint_url,
            api_key,
            model,
            language,
            client: reqwest::Client::new(),
        }
    }

    fn transcription_url(&self) -> String {
        format!("{}/v1/audio/transcriptions", self.endpoint_url)
    }
}

#[async_trait]
impl TranscriptionProvider for RemoteTranscriptionProvider {
    async fn transcribe(
        &self,
        audio: Vec<f32>,
        language: Option<String>,
    ) -> std::result::Result<TranscriptResult, TranscriptionError> {
        let wav_bytes = encode_wav(&audio);
        let wav_len = wav_bytes.len();
        info!(
            "🌐 RemoteTranscriptionProvider: sending {} samples ({} WAV bytes) to {}",
            audio.len(),
            wav_len,
            self.transcription_url()
        );

        // Build multipart form
        let audio_part = multipart::Part::bytes(wav_bytes)
            .file_name("audio.wav")
            .mime_str("audio/wav")
            .map_err(|e| TranscriptionError::EngineFailed(format!("Failed to build WAV part: {}", e)))?;

        let mut form = multipart::Form::new()
            .part("file", audio_part)
            .text("model", self.model.clone())
            .text("response_format", "json");

        // Add language hint - prefer the per-endpoint language setting over the global preference
        let effective_lang = self.language.as_deref().or(language.as_deref());
        if let Some(lang) = effective_lang {
            if lang != "auto" && lang != "auto-translate" && !lang.is_empty() {
                info!("🌐 Using language hint: {}", lang);
                form = form.text("language", lang.to_string());
            }
        }

        // Build request with optional Bearer token
        let mut request = self.client.post(self.transcription_url()).multipart(form);

        if let Some(ref key) = self.api_key {
            if !key.is_empty() {
                request = request.bearer_auth(key);
            }
        }

        // Send and parse response
        let response = request.send().await.map_err(|e| {
            warn!("🌐 Remote endpoint request failed: {}", e);
            TranscriptionError::EngineFailed(format!("HTTP request failed: {}", e))
        })?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            warn!("🌐 Remote endpoint returned HTTP {}: {}", status, body);
            return Err(TranscriptionError::EngineFailed(format!(
                "Remote endpoint returned HTTP {}: {}",
                status, body
            )));
        }

        let json: serde_json::Value = response.json().await.map_err(|e| {
            TranscriptionError::EngineFailed(format!("Failed to parse response JSON: {}", e))
        })?;

        let text = json
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();

        info!("🌐 Remote transcription result: '{}'", text);

        Ok(TranscriptResult {
            text,
            confidence: None, // Remote endpoints typically don't expose per-chunk confidence
            is_partial: false,
        })
    }

    async fn is_model_loaded(&self) -> bool {
        // Remote provider doesn't load a local model — always ready if URL is set
        !self.endpoint_url.is_empty()
    }

    async fn get_current_model(&self) -> Option<String> {
        Some(self.model.clone())
    }

    fn provider_name(&self) -> &'static str {
        "Remote Endpoint"
    }
}

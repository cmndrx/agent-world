# Local voice messages

In a Codex or Claude resident chat, click the microphone, speak for up to 30
seconds, and click **Finish recording**. The transcript is appended to your
existing draft. Review/edit it and click **Send** using the normal model, effort,
attachments and execution-access controls. Recording never starts an agent turn.

While voice is enabled, the completed reply to a message you send is spoken
locally. Speech reads the returned summary and limitations (up to 3,900
characters); the complete answer, checks and code stay in chat. Existing history,
unrelated residents, failed runs and scheduled work are not automatically read.
**Record again** starts the next message when the resident is available.
**Stop speaking** stops playback. **End voice**, changing chats/providers,
opening Scheduled or closing chat ends local audio and disables spoken replies.
Ordinary agent work already sent continues; use its normal **Stop run** control
to cancel it.

This first version is push-to-talk with transcript review, rather than an
always-listening or simultaneous speech conversation. It does not use the Codex
realtime endpoint or require an OpenAI audio API key. The text agent still uses
its existing online provider connection, permissions and account limits.

## Lightweight macOS setup

The native provider needs:

- `whisper-cli` from whisper.cpp, discoverable on PATH or under `/opt/homebrew/bin`.
- A compatible Whisper model at `AGENT_WORLD_HOME/models/ggml-tiny.en.bin`.
- macOS `/usr/bin/say` and `ffmpeg` (PATH or `/opt/homebrew/bin`).

The default home is `~/.agent-world`. This machine already had whisper.cpp,
ffmpeg and the 77,704,715-byte tiny English model installed. The model was copied
to `~/.agent-world/models/ggml-tiny.en.bin`, preserving the original. No new model
download or full VoiceStudio installation was required. Native transcription is
English in this version; configure VoiceStudio for other engines/languages.

To reuse another compatible model, create `speech.json` in `AGENT_WORLD_HOME`:

```json
{"whisperModel":"/absolute/path/to/ggml-tiny.en.bin"}
```

`AGENT_WORLD_WHISPER_MODEL` overrides that path. Models are local user assets and
are not bundled into Git or the Electron package. Other computers need their own
speech setup. There are no automatic package or model downloads.

## Optional VoiceStudio backend

Agent World can use [VoiceStudio](https://github.com/debpalash/VoiceStudio) as a
separate local speech service. Install/configure the studio and its chosen ASR
and TTS models first, then set `speech.json`:

```json
{
  "voicestudioURL":"http://127.0.0.1:3900",
  "ttsModel":"tts-1",
  "voice":"default"
}
```

`AGENT_WORLD_VOICESTUDIO_URL` overrides the backend address. Only loopback HTTP
addresses are accepted, redirects are refused, and no hosted-service fallback or
credential changes occur. Protected/authenticated or remote VoiceStudio servers
are not supported in this first adapter. Leave `voicestudioURL` unset for the
lightweight native provider. Configuration is read on each speech request.

The adapter follows VoiceStudio's published contracts:

- `GET /health` before requesting the microphone.
- `POST /v1/audio/transcriptions`: multipart WAV, `model=whisper-1`, JSON text.
- `POST /v1/audio/speech`: text, configured model/voice, WAV output.

`tts-1` is VoiceStudio's compatibility alias for its selected engine, not an
OpenAI cloud request. Engine/model readiness errors are shown without retrying
or installing anything. The adapter uses the documented API without copying
VoiceStudio application code. Reference reviewed: upstream commit
`8beed7e3df1983776658d03e7e4108e49ef385b1`, especially
`backend/api/routers/openai_compat.py` and `docs/speech-platform.md`.

## Privacy and limits

Microphone capture starts only after the human clicks the mic. Recording stops
at 30 seconds, cancellation or completion. Audio is resampled to mono 16 kHz
PCM. Raw audio is not added to Agent World's history: native processing uses
private temporary files, removed on success, failure and cancellation. An abrupt
OS/process crash can leave temporary files; this is not guaranteed secure erase.
VoiceStudio manages its own storage according to its configuration.

Only a transcript the human sends becomes a normal saved prompt. Speech
processing is serialized, bounded and cancellable; local speech failure leaves
the text workflow usable. The normal agent queue, approval and acceptance rules
continue to apply. No voice recording earns XP or counts as completed work.

Native microphone permission and actual speaker quality must be checked on the
user's machine. A synthesized test sentence can verify the speech engines but
does not establish real microphone capture, acoustic echo handling or a complete
provider conversation. macOS may ask for microphone permission when first used.

## Previous realtime experiment

The former Codex realtime transport remains in source/tests for reference, but
the composer now uses this local flow. Its earlier `realtime conversation requires
API key auth` failure has not been resolved or worked around by changing login.

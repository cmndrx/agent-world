# Local voice messages

In a Codex or Claude resident chat, click the microphone, speak for up to 30
seconds, and click **Finish recording**. The transcript is appended to your
existing draft. Review/edit it and click **Send** using the normal model, effort,
attachments and execution-access controls. Recording never starts an agent turn.

Use **Spoken replies: On** to hear responses to typed or recorded messages without keeping the microphone open. Recording also enables spoken replies. **Read aloud** on a completed response plays that selected summary and limitations on demand. Toggle spoken replies off to cancel queued audio.

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

## First-use setup (all desktop platforms)

Open **Voice setup & test** in a resident chat. A machine missing native speech
tools enters this setup automatically when the microphone is clicked. Setup does
not submit an agent prompt.

1. Choose **Install local voice** after reviewing the size/source/license notice.
   It downloads the pinned quantized English Whisper model from Hugging Face
   (40,843,851 bytes of weights; allow about 60 MB including configuration and
   runtime overhead). The app bundles its WASM runtime; users need no Python,
   Homebrew, shell commands or API key. Progress is per file, not an overall
   percentage. Cancel stops the worker; retry can reuse cached files.
2. Use **Test microphone**, grant OS permission if requested, select the correct
   microphone and watch its input meter. Finish recording and review the test
   transcript inside setup. It does not enter your chat draft or get sent.
3. Use **Test speakers**, choose an installed local speaking voice, check your
   system output/headphones, and click **I heard the test** only if audible.
   The app enables this confirmation only after playback actually starts.
4. Use **Copy voice diagnostics** for support. Reports include app version, voice
   build identifier, platform, backend, tool/model readiness, renderer microphone
   permission query, signal/test status, local voice count and error category.
   They omit audio, transcript, prompt, device name/ID, file paths, URLs, accounts
   and credentials. A renderer permission result does not independently certify
   macOS native consent. Nothing is uploaded automatically.

Transcription runs in an app-owned worker with WASM CPU inference on macOS,
Windows and Linux. Speech output uses `speechSynthesis` voices explicitly marked
`localService`; remote voices are excluded. Voice quality and installed language
availability depend on the OS. If no local voice is installed, setup explains how
to install one in OS speech settings. This is a user action, not an automatic
language-package or OS-settings change. Existing native/VoiceStudio speech can be
selected with **Use existing local backend**.

Model selection is remembered per app origin. Previously approved models reload
from cache without silently fetching missing files; cache loss sends users back
to the visible download action. Clearing app data, a changing dev-server port,
storage pressure or cache eviction can require setup again. The cached model is
not an installed global tool and is not included in Git. Audio stays local;
normal agent messages still use the existing online provider connection.

Model: `onnx-community/whisper-tiny.en`, revision
`2575352d61be1bf7225cf8f8b268a4678025fc58`. Upstream
`openai/whisper-tiny.en` Hugging Face model card lists Apache-2.0; the ONNX
conversion repository is the download source. Transformers.js is pinned to
3.8.1. Model inference/downloads are separate from provider authentication.

Recovery messages distinguish permission denial, missing/changed microphone,
busy devices, zero input signal, model/download failure and speaker failure.
Diagnostics never call a provider model or synthesize agent activity.

## Existing lightweight macOS backend

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
speech setup. The native backend does not automatically download tools or models; the in-app setup above provides the explicit model download option.

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

If clipboard access is unavailable, the diagnostics report remains selectable in setup. Click it and press Command+C on Mac or Ctrl+C on Windows/Linux. No report is uploaded automatically.

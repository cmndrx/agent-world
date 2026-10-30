# Voice release checks

As of October 24, 2026. This records evidence, not a blanket platform certification.

| Scenario | Verified evidence | Remaining check |
|---|---|---|
| Clean macOS, Windows, Linux home with no native speech tools | Automated isolated configuration tests identify missing tools; no key, download or provider call from status/setup | Actual clean OS installations |
| In-app model download | Native packaged macOS app displayed file progress and successfully loaded pinned q8 model in WASM worker | Windows/Linux packaged downloads, restrictive networks |
| Model transcription | Same pinned q8 model transcribed a synthesized sentence correctly in 824 ms under Node CPU; load 7,252 ms including download | Browser-WASM transcription with an actual microphone phrase; Node CPU is not WASM timing proof |
| Local speaker test | Native macOS app selected local Samantha voice and reached Speaking; confirmation remains a human choice | Physical audibility confirmation, Windows/Linux installed voices |
| F998 USB | Human confirmed microphone/transcription worked after the prior native entitlement fix; multichannel/quiet-input regressions pass | Fresh setup's managed-model mic test with F998 |
| Bluetooth | Capture uses selected standard MediaStream input; disconnect/absent/busy cases have recovery messages | Real headset capture/output, device switching and reconnection |
| Permission denied | Native consent/origin/audio-only boundary regressions and classified recovery tests | Fresh OS deny → privacy settings → reopen with permission |
| Cancel/retry | Worker cancellation rejects jobs and releases resources; failed install can be retried without success flags | Cancel a real network download; retry under interrupted Wi-Fi |
| Cache reuse/offline | Cached-only model load is enforced after remembered selection; missing cache returns setup instead of silent download | Packaged offline restart and cache eviction on every OS |
| Diagnostics privacy | Allowlist tests exclude transcripts, prompts, credentials, paths, URLs and device IDs | macOS clipboard denied in actual app; selectable report fallback added. Verify selected-text copy and other OS clipboards |
| Live conversation | Speech remains scoped to selected human sends and read-aloud replies, existing ownership/cancel tests pass | User-approved full voice request/reply on each supported OS |

## Manual release gate

On each supported OS/architecture, use a fresh local app-data profile and current
package. Record the version/voice build from diagnostics. Confirm the size and
source notice precedes model download, and no API key or Terminal is requested.
Cancel and retry setup. Record the known phrase “My voice is ready for Agent
World,” review the transcript, play the speaker test and confirm audibility.
Then explicitly send a harmless request in a disposable project and check the
returned reply is spoken once, Stop speaking works, and changing chats stops
audio. Repeat with USB and Bluetooth where supported, then disconnect/reconnect
the device. Restart offline with cached assets and verify no hidden download.

Test denied microphone access, missing local OS voices, unavailable model host,
low disk/cache eviction and old build diagnostics. Diagnostics must not contain
the known phrase or device identifiers. No test may operate on a real work queue
or report accepted work. A passing fixture/build alone does not satisfy this gate.

Current limitations: English transcription only; CPU inference speed and RAM vary;
OS speech voices vary; browser cache may be evicted; downloads require access to
Hugging Face; no automatic update delivery to older installed builds. Distribute
the newly built package explicitly. Windows/Linux native packaging/signing and
real hardware are unavailable on this Mac and remain release holds for a claim
of verified support.

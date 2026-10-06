# Focused deliverable review — 2026-10-05

## As built

Needs-you and Reviews open a focused review dialog with task context, legacy notes, structured outputs/checks, source-chat actions, local text preview and human review decisions. Accept requires explicit review confirmation. Return requires feedback, changes the task to In progress, and records a dated review history. No prompt or message is sent to an agent. The next agent reads the recorded feedback through the existing state/helper API.

Structured references contain kind (output/check), value, optional label, reported result (unknown/passed/failed), recorder label and server-stamped recorded time. The bridge validates them and preserves unchanged timestamps. Recorder names and check results are claims entered by a user/agent, not authenticated identity or independently observed success. Existing free-text evidence remains intact. Omitted references are preserved by the API/helper. The task editor adds/removes outputs and checks in optional details; the review dialog links to editing evidence. Human review history cannot be overwritten through ordinary task updates. Last feedback appears on the task board. Structured references qualify as recorded review notes under the existing daily reward ceiling.

POST `/api/review` requires task/project/current version, decision `accept` or `return`, optional feedback, and `acceptedByUser: true` for acceptance. It uses the existing local-origin and JSON restrictions, persists metadata and sends the normal productivity SSE update. The API is local and unauthenticated; explicit confirmation is a workflow gate, not proof of a human identity.

POST `/api/artifact-preview` requires task/project and an exact recorded output path. It only returns plain text from a regular file resolved within that task's local project, refuses hidden paths and symlink escapes, restricts extensions, rejects NUL-containing binary content and caps reads at 64 KiB. HTML is shown as text and never executed. Preview contents are current at read time, not a frozen version of the delivered artifact. Non-local projects, external files, missing files and unsupported formats retain copy-path/web-link fallbacks. This does not expose an arbitrary file-serving endpoint or launch desktop applications.

## Verification

84 Node tests pass; Vite build passes with the existing roughly 963 KB minified-client chunk warning. Tests cover structured validation/provenance timestamps, unchanged fields, explicit acceptance, required return feedback, version conflicts, immutable review history, API origin rejection/persistence and bounded text/hidden/binary/symlink preview checks.

Isolated browser QA (separate AGENT_WORLD_HOME, demo chip, port 4792) verified direct review entry, structured records, plain-text preview with literal script markup, acceptance rejection without consent, return rejection without feedback, successful return with feedback, visible In progress state and recorded feedback. No console errors. The real project review also displayed its structured Codex records and successfully previewed this report; the decision was left to the human. No real human acceptance or reward spending performed. Synthetic metadata was not added to the real event inbox.

## Remaining boundaries

Coding chats without supported URLs still use Copy ID/Show. Known app chat/web output URLs open their websites; authenticated navigation remains unverified. Local previews support text only; PDFs/images/desktop opening require a later bounded implementation. Review records are bounded to the latest 20 decisions. No claim of measured human time savings or correctness certification.

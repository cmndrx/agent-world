# Read-only browser preview prototype — October 12, 2026

Verified using the installed Codex CLI, its existing cua_repl browser tools and Chrome extension. No new browser engine, OpenAI API key or hosted-browser API used.

## Evidence

- Direct mcpServer/tool/call in an ephemeral thread without a model turn returned native-app state, but browser inventory reported missing session_id/turn_id. Those identifiers were not fabricated.
- After the human authorized test prompts, a real read-only Codex turn successfully listed Chrome. No built-in iab browser was attached to that standalone CLI session. The first test stopped without capturing unrelated tabs.
- A second bounded test opened one dedicated Agent World localhost tab, then made two getScreenshot calls. Both returned actual image/jpeg MCP blocks in the CLI JSONL stream, approximately 150 KB base64 each. The only extra tab operation was marking the preview as a deliverable. No clicks, typing, scrolling, gameplay actions or permission changes.
- The loopback viewer rendered both frames. Previous frame and Follow newest frame were verified in Chrome, with “Recorded test frames — run ended.” displayed. It follows newly appended screenshot blocks if the source stream continues, but captures nothing itself.

## Run the viewer

Use Node 18 or newer:

```
node scripts/browser-preview.mjs --events /path/to/codex-events.jsonl --port 4795
```

Open http://127.0.0.1:4795/. The viewer accepts only GET, serves only its own page/status/captured frames and listens on loopback. It does not serve arbitrary files or expose raw event text. Images and private event logs remain outside the repository.

The current test stream is `/tmp/aw-browser-capture-events.jsonl`. The active viewer was started with that file. These scratch files are temporary, not durable saved gameplay.

The bounded test instruction is in `browser-preview-prompt.txt`. Running that prompt through `codex exec --json` requires the human's authorization and uses their provider account. The viewer itself never launches a prompt.

## Limits and next pass

This is a standalone transport/viewer proof, not an automatic live browser panel in resident chats. It does not embed ChatGPT's viewer, capture continuous video or manufacture cursor motion. A screenshot appears only when the actual browser tool emits one. Native Windows and built-in iab capture are unverified.

Next: connect this proven MCP image delivery to the exact game-owned run/conversation, add an explicit view-only panel with stale/disconnected status and opt-in capture scope, and test it with a bounded browser task. Do not collect arbitrary browser tabs, native windows or screenshots in canonical activity logs. No capture should occur merely because a resident is selected. Preserve provider permissions and approval handling.

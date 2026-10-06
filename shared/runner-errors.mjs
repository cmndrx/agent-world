// Map private CLI diagnostics to safe, actionable messages. Never expose raw output.
export function runnerError(diagnostic,code){
 if(/already has an active writer|thread-store conflict/i.test(diagnostic))return 'Codex currently owns this conversation. The CLI cannot continue it while that ownership is active. Continue in Codex, or explicitly choose New conversation in the game. Your prompt was not executed; no automatic retry.';
 if(/unauthorized|authentication|sign.?in|401/i.test(diagnostic))return 'Codex authentication failed. Check sign-in in Codex before retrying.';
 if(/session.*not found|thread.*not found|no session found/i.test(diagnostic))return 'Codex could not find this conversation. Check its link before retrying; no new conversation was created.';
 return `Codex exited with code ${code}. No response was recorded. Inspect the project before retrying.`;
}

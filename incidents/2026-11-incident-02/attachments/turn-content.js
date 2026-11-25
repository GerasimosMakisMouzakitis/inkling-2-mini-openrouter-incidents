// Usage: node turn-content.js [--session <id>] [--turn <n>]
// Shows the assistant text content of stop-finish calls to see if the model
// stopped mid-task. Reads events.jsonl from the session-state folder.
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const sIdx = args.indexOf('--session');
const sessionId = sIdx >= 0 ? args[sIdx + 1] : '31476d88-97d5-49ba-97d5-aa383fb6a6a4';
const tIdx = args.indexOf('--turn');
const onlyTurn = tIdx >= 0 ? parseInt(args[tIdx + 1], 10) : null;

const eventsPath = path.join(os.homedir(), '.copilot', 'session-state', sessionId, 'events.jsonl');
const lines = fs.readFileSync(eventsPath, 'utf8').split('\n').filter(Boolean);

// Collect assistant messages that have text content and no tool requests
// (i.e. the model ended its turn with text)
const stopMessages = [];
for (const line of lines) {
  let ev;
  try { ev = JSON.parse(line); } catch { continue; }
  if (ev.type !== 'assistant.message') continue;
  const d = ev.data;
  if (!d || !d.content) continue;
  const hasTools = d.toolRequests && d.toolRequests.length > 0;
  if (hasTools) continue;
  stopMessages.push({
    turnId: d.turnId,
    model: (d.model || '').split('/').pop(),
    content: d.content.trim(),
    ts: ev.timestamp,
  });
}

console.log(`=== Assistant text-only messages (turn ended with text): ${stopMessages.length} ===\n`);
for (const m of stopMessages) {
  if (onlyTurn !== null && String(m.turnId) !== String(onlyTurn)) continue;
  const preview = m.content.length > 400 ? m.content.slice(0, 400) + ' [...]' : m.content;
  console.log(`--- turnId=${m.turnId} | ${m.model} | ${m.ts} ---`);
  console.log(preview);
  console.log();
}
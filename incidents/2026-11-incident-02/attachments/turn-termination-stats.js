// Usage: node turn-termination-stats.js [--session <id>]
// Investigates premature turn termination: calls with finish_reason='stop'
// that produced little/no output, plus stop events with 0 tokens.
const path = require('path');
const os = require('os');
const { DatabaseSync } = require('node:sqlite');

const STORE = path.join(os.homedir(), '.copilot', 'session-store.db');
const args = process.argv.slice(2);
const sessionIdx = args.indexOf('--session');
const sessionId = sessionIdx >= 0 ? args[sessionIdx + 1] : '31476d88-97d5-49ba-97d5-aa383fb6a6a4';

const db = new DatabaseSync(STORE, { readOnly: true });

// 1. All calls with finish_reason='stop' (model ended its turn)
const stops = db.prepare(`
  SELECT turn_index, input_tokens, output_tokens, reasoning_tokens,
         duration_ms, created_at, model
  FROM assistant_usage_events
  WHERE session_id = ? AND finish_reason = 'stop'
  ORDER BY created_at
`).all(sessionId);

console.log(`=== Calls with finish_reason='stop' (${stops.length}) ===`);
for (const s of stops) {
  console.log(`Turn ${s.turn_index} | in=${s.input_tokens} out=${s.output_tokens} reasoning=${s.reasoning_tokens} dur=${s.duration_ms}ms ${s.created_at}`);
}

// 2. Distribution of finish reasons
const reasons = db.prepare(`
  SELECT finish_reason, COUNT(*) as n,
         SUM(output_tokens) as out, AVG(output_tokens) as avg_out
  FROM assistant_usage_events WHERE session_id = ?
  GROUP BY finish_reason ORDER BY n DESC
`).all(sessionId);

console.log('\n=== Finish reason distribution ===');
for (const r of reasons) {
  console.log(`${r.finish_reason || '(null)'}: ${r.n} calls | total_out=${r.out} | avg_out=${Math.round(r.avg_out)}`);
}

// 3. Short-output calls (possible mid-task stops): output < 100 tokens
const shorts = db.prepare(`
  SELECT turn_index, output_tokens, reasoning_tokens, duration_ms, finish_reason, created_at
  FROM assistant_usage_events
  WHERE session_id = ? AND output_tokens < 100 AND input_tokens > 0
  ORDER BY created_at
`).all(sessionId);

console.log(`\n=== Short-output calls (<100 output tokens): ${shorts.length} ===`);
const byTurn = {};
for (const s of shorts) {
  byTurn[s.turn_index] = (byTurn[s.turn_index] || 0) + 1;
}
console.log('Per turn:', Object.entries(byTurn).map(([t, n]) => `T${t}=${n}`).join(' '));

// 4. Last call of each turn (the one that ended the turn)
console.log('\n=== Last call per turn ===');
const lastCalls = db.prepare(`
  SELECT a.turn_index, a.output_tokens, a.reasoning_tokens, a.duration_ms,
         a.finish_reason, a.created_at
  FROM assistant_usage_events a
  JOIN (SELECT turn_index, MAX(id) as max_id FROM assistant_usage_events
        WHERE session_id = ? GROUP BY turn_index) b
    ON a.id = b.max_id
  ORDER BY a.turn_index
`).all(sessionId);

for (const c of lastCalls) {
  console.log(`Turn ${c.turn_index} | out=${c.output_tokens} reasoning=${c.reasoning_tokens} dur=${c.duration_ms}ms finish=${c.finish_reason || '(null)'} ${c.created_at}`);
}

// 5. Gaps between turns (user had to intervene)
console.log('\n=== Inter-turn gaps (user intervention) ===');
const turnTimes = db.prepare(`
  SELECT turn_index, MIN(created_at) as first, MAX(created_at) as last
  FROM assistant_usage_events WHERE session_id = ? GROUP BY turn_index ORDER BY turn_index
`).all(sessionId);

for (let i = 1; i < turnTimes.length; i++) {
  const prev = new Date(turnTimes[i - 1].last);
  const cur = new Date(turnTimes[i].first);
  const gapMin = ((cur - prev) / 60000).toFixed(1);
  console.log(`Turn ${turnTimes[i - 1].turn_index} → ${turnTimes[i].turn_index}: ${gapMin} min gap`);
}

db.close();
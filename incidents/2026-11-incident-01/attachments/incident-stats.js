// Usage: node incident-stats.js [--session <id>]
// Collects incident statistics for a session from session-store.db.
// NOTE: This script reads the local session-store.db. The STORE path uses
// a generic home-directory reference and does not expose personal data.
const path = require('path');
const os = require('os');
const { DatabaseSync } = require('node:sqlite');

const STORE = path.join(os.homedir(), '.copilot', 'session-store.db');
const args = process.argv.slice(2);
const sessionIdx = args.indexOf('--session');
const sessionId = sessionIdx >= 0 ? args[sessionIdx + 1] : '31476d88-97d5-49ba-97d5-aa383fb6a6a4';

const db = new DatabaseSync(STORE, { readOnly: true });

// Per-turn stats
const turns = db.prepare(`
  SELECT turn_index, model, COUNT(*) as calls,
         SUM(input_tokens) as input, SUM(output_tokens) as output,
         SUM(cache_read_tokens) as cache_read, SUM(cache_write_tokens) as cache_write,
         SUM(reasoning_tokens) as reasoning,
         MIN(created_at) as first_call, MAX(created_at) as last_call
  FROM assistant_usage_events
  WHERE session_id = ?
  GROUP BY turn_index, model
  ORDER BY turn_index, model
`).all(sessionId);

console.log('=== Per-turn stats ===');
for (const t of turns) {
  console.log(`Turn ${t.turn_index} | ${t.model.split('/').pop()} | calls=${t.calls} | in=${t.input} | out=${t.output} | cache_r=${t.cache_read} | cache_w=${t.cache_write} | reasoning=${t.reasoning} | ${t.first_call} → ${t.last_call}`);
}

// Totals
const totals = db.prepare(`
  SELECT COUNT(*) as calls, SUM(input_tokens) as input, SUM(output_tokens) as output,
         SUM(cache_read_tokens) as cache_read, SUM(cache_write_tokens) as cache_write,
         SUM(reasoning_tokens) as reasoning
  FROM assistant_usage_events WHERE session_id = ?
`).get(sessionId);

console.log('\n=== Totals ===');
console.log(`calls=${totals.calls} | in=${totals.input} | out=${totals.output} | cache_r=${totals.cache_read} | cache_w=${totals.cache_write} | reasoning=${totals.reasoning}`);

// Stop events (0 tokens)
const stops = db.prepare(`
  SELECT turn_index, input_tokens, output_tokens, duration_ms, created_at, finish_reason
  FROM assistant_usage_events
  WHERE session_id = ? AND input_tokens = 0 AND output_tokens = 0
  ORDER BY created_at
`).all(sessionId);

console.log('\n=== Stop events (0 tokens) ===');
for (const s of stops) {
  console.log(`Turn ${s.turn_index} | in=0 | out=0 | duration=${s.duration_ms}ms | ${s.created_at} | finish=${s.finish_reason}`);
}

// Turn 7 & 8 detail (the run-away loops)
for (const t of [7, 8]) {
  const calls = db.prepare(`
    SELECT input_tokens, output_tokens, reasoning_tokens, duration_ms, created_at, finish_reason
    FROM assistant_usage_events
    WHERE session_id = ? AND turn_index = ?
    ORDER BY id
  `).all(sessionId, t);

  console.log(`\n=== Turn ${t} detail (${calls.length} calls) ===`);
  if (calls.length > 0) {
    const first = calls[0];
    const last = calls[calls.length - 1];
    console.log(`First: in=${first.input_tokens} out=${first.output_tokens} dur=${first.duration_ms}ms ${first.created_at}`);
    console.log(`Last:  in=${last.input_tokens} out=${last.output_tokens} dur=${last.duration_ms}ms ${last.created_at}`);
    // Check input delta
    if (calls.length > 1) {
      const delta = calls[1].input_tokens - calls[0].input_tokens;
      console.log(`Input delta (call 2 - call 1): ${delta} tokens`);
    }
    // Count unique output values
    const outputs = new Set(calls.map(c => c.output_tokens));
    console.log(`Unique output values: ${[...outputs].join(', ')}`);
    // Count unique finish reasons
    const finishes = new Set(calls.map(c => c.finish_reason));
    console.log(`Unique finish reasons: ${[...finishes].join(', ')}`);
  }
}

db.close();
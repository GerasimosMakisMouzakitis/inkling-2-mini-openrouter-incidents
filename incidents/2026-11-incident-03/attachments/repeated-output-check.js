#!/usr/bin/env node
/**
 * repeated-output-check.js
 *
 * Dedicated detector for repeated identical-output loops (INC-2026-11-24-003).
 * Scans assistant_usage_events for consecutive runs of identical output_tokens
 * with reasoning_tokens = 0, which is the signature of the degenerate loop.
 *
 * Data privacy: uses os.homedir() — no personal paths are hardcoded.
 */

const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const SESSION_ID = '310da4c2-ec78-497f-9437-48896389d873';
const DB_PATH = path.join(os.homedir(), '.copilot', 'session-store.db');

function main() {
  const db = new Database(DB_PATH, { readonly: true });

  const rows = db.prepare(`
    SELECT turn_index, input_tokens, output_tokens, reasoning_tokens,
           duration_ms, created_at
    FROM assistant_usage_events
    WHERE session_id = ? AND model LIKE '%inkling%'
    ORDER BY created_at
  `).all(SESSION_ID);

  let runs = [];
  let current = null;

  for (const r of rows) {
    const key = `${r.turn_index}:${r.output_tokens}:${r.reasoning_tokens}`;
    if (current && current.key === key) {
      current.count++;
      current.max_in = Math.max(current.max_in, r.input_tokens);
      current.last_at = r.created_at;
    } else {
      if (current) runs.push(current);
      current = {
        key,
        turn: r.turn_index,
        output: r.output_tokens,
        reasoning: r.reasoning_tokens,
        count: 1,
        min_in: r.input_tokens,
        max_in: r.input_tokens,
        first_at: r.created_at,
        last_at: r.created_at,
      };
    }
  }
  if (current) runs.push(current);

  const loops = runs.filter(r => r.count >= 5);
  console.log('=== Repeated-output runs (>= 5 consecutive identical calls) ===\n');
  console.table(loops.map(l => ({
    turn: l.turn,
    output_tokens: l.output,
    reasoning: l.reasoning,
    consecutive_calls: l.count,
    min_input: l.min_in,
    max_input: l.max_in,
    first_at: l.first_at,
    last_at: l.last_at,
  })));

  const totalLoopCalls = loops.reduce((s, l) => s + l.count, 0);
  console.log(`\nTotal calls inside repeated-output loops: ${totalLoopCalls}`);
  console.log(`Total Inkling calls: ${rows.length}`);
  console.log(`Loop ratio: ${(100 * totalLoopCalls / rows.length).toFixed(1)}%`);

  db.close();
}

main();
#!/usr/bin/env node
/**
 * incident-stats.js
 *
 * Statistics collection script for INC-2026-11-24-003.
 * Extracts per-turn and repeated-output statistics from the VS Code
 * session-store.db (table assistant_usage_events).
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

  console.log('=== Per-turn aggregation (Inkling only) ===\n');
  const perTurn = db.prepare(`
    SELECT turn_index,
           COUNT(*) as calls,
           SUM(input_tokens) as input,
           SUM(output_tokens) as output,
           SUM(reasoning_tokens) as reasoning,
           MIN(created_at) as first_at,
           MAX(created_at) as last_at
    FROM assistant_usage_events
    WHERE session_id = ? AND model LIKE '%inkling%'
    GROUP BY turn_index
    ORDER BY turn_index
  `).all(SESSION_ID);
  console.table(perTurn);

  console.log('\n=== Repeated-output detection per turn ===\n');
  for (const row of perTurn) {
    const repeated = db.prepare(`
      SELECT output_tokens,
             COUNT(*) as n,
             MIN(input_tokens) as min_in,
             MAX(input_tokens) as max_in,
             MIN(created_at) as first_at,
             MAX(created_at) as last_at
      FROM assistant_usage_events
      WHERE session_id = ? AND turn_index = ? AND model LIKE '%inkling%'
      GROUP BY output_tokens
      ORDER BY n DESC
      LIMIT 5
    `).all(SESSION_ID, row.turn_index);
    console.log(`Turn ${row.turn_index}:`);
    console.table(repeated);
  }

  console.log('\n=== Model distribution ===\n');
  const models = db.prepare(`
    SELECT model, COUNT(*) as n
    FROM assistant_usage_events
    WHERE session_id = ?
    GROUP BY model
  `).all(SESSION_ID);
  console.table(models);

  console.log('\n=== Grand totals (Inkling only) ===\n');
  const totals = db.prepare(`
    SELECT COUNT(*) as calls,
           SUM(input_tokens) as input,
           SUM(output_tokens) as output,
           SUM(reasoning_tokens) as reasoning,
           SUM(duration_ms) as duration
    FROM assistant_usage_events
    WHERE session_id = ? AND model LIKE '%inkling%'
  `).get(SESSION_ID);
  console.table([totals]);

  db.close();
}

main();
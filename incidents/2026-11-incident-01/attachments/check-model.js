// Usage: node check-model.js [--session <id>]
// Inspects the current session's model and service tier from session-store.db.
// NOTE: This script reads the local session-store.db. The STORE path uses
// a generic home-directory reference and does not expose personal data.
const path = require('path');
const os = require('os');
const { DatabaseSync } = require('node:sqlite');

const STORE = path.join(os.homedir(), '.copilot', 'session-store.db');
const args = process.argv.slice(2);
const sessionIdx = args.indexOf('--session');
const sessionId = sessionIdx >= 0 ? args[sessionIdx + 1] : null;

const db = new DatabaseSync(STORE, { readOnly: true });

const sessions = sessionId
  ? db.prepare('SELECT id, cwd, summary, created_at, updated_at FROM sessions WHERE id = ?').all(sessionId)
  : db.prepare('SELECT id, cwd, summary, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT 1').all();

for (const s of sessions) {
  console.log('=== Session ===');
  console.log('id:', s.id);
  console.log('cwd:', s.cwd);
  console.log('summary:', s.summary);
  console.log('created_at:', s.created_at);
  console.log('updated_at:', s.updated_at);

  const models = db.prepare('SELECT model, COUNT(*) as n FROM assistant_usage_events WHERE session_id = ? GROUP BY model').all(s.id);
  console.log('\nModels used (assistant_usage_events):');
  for (const m of models) console.log(`  ${m.model}: ${m.n} calls`);

  const cols = db.prepare('PRAGMA table_info(assistant_usage_events)').all();
  console.log('\nassistant_usage_events columns:', cols.map(c => c.name).join(', '));

  const sample = db.prepare('SELECT * FROM assistant_usage_events WHERE session_id = ? ORDER BY id LIMIT 1').all(s.id);
  if (sample.length) {
    console.log('\nSample call row:');
    console.log(JSON.stringify(sample[0], null, 2));
  }
}

db.close();

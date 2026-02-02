import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const dbPath = resolve(process.cwd(), '../../data/db.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS corpora (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    category TEXT,
    difficulty_score INTEGER,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    paragraph_id TEXT,
    speaker_id TEXT,
    file_path TEXT,
    processed_path TEXT,
    duration_ms INTEGER,
    file_size_kb INTEGER,
    snr_db REAL,
    peak_dbfs REAL,
    clipping_count INTEGER,
    transcript TEXT,
    whisper_transcript TEXT,
    cer_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS speakers (
    id TEXT PRIMARY KEY,
    hometown TEXT,
    birth_year INTEGER,
    language_background TEXT
  );

  CREATE TABLE IF NOT EXISTS generated_corpus (
    id TEXT PRIMARY KEY,
    text TEXT,
    topic TEXT,
    difficulty TEXT,
    analysis_json TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const recordingColumns = db.prepare(`PRAGMA table_info(recordings);`).all() as { name: string }[];
const recordingColumnNames = new Set(recordingColumns.map((c) => c.name));
if (!recordingColumnNames.has('processed_path')) {
  db.exec('ALTER TABLE recordings ADD COLUMN processed_path TEXT;');
}

const corporaColumns = db.prepare(`PRAGMA table_info(corpora);`).all() as { name: string }[];
const corporaColumnNames = new Set(corporaColumns.map((c) => c.name));
if (!corporaColumnNames.has('source')) {
  db.exec('ALTER TABLE corpora ADD COLUMN source TEXT;');
}
if (!corporaColumnNames.has('created_at')) {
  db.exec('ALTER TABLE corpora ADD COLUMN created_at DATETIME;');
}

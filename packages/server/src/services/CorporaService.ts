import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Paragraph } from '@xiangxi/shared';
import { db } from '../db.js';

interface CorporaEntry {
  id: string;
  content: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  estimatedDuration?: number;
}

const corporaDir = resolve(process.cwd(), '../../corpora');

export function loadCorporaToDb() {
  const files = readdirSync(corporaDir).filter((f) => f.endsWith('.json'));
  const insert = db.prepare(
    'INSERT OR IGNORE INTO corpora (id, title, content, category, difficulty_score, source) VALUES (?, ?, ?, ?, ?, ?)'
  );

  for (const file of files) {
    const category = file.replace('.json', '');
    const raw = JSON.parse(readFileSync(resolve(corporaDir, file), 'utf-8')) as CorporaEntry[];
    for (const entry of raw) {
      const difficultyScore = entry.difficulty === 'hard' ? 3 : entry.difficulty === 'medium' ? 2 : 1;
      insert.run(entry.id, category, entry.content, category, difficultyScore, 'local');
    }
  }
}

export function getNextParagraph(speakerId: string) {
  const rows = db.prepare('SELECT id, content, category, difficulty_score FROM corpora').all();
  const counts = db
    .prepare('SELECT paragraph_id, COUNT(*) as cnt FROM recordings WHERE speaker_id = ? GROUP BY paragraph_id')
    .all(speakerId);

  const completedSet = new Set(counts.map((c: { paragraph_id: string }) => c.paragraph_id));
  const next = rows.find((r: { id: string }) => !completedSet.has(r.id)) ?? rows[0];

  const byCategory: Record<string, number> = {};
  for (const row of rows) {
    if (!byCategory[row.category]) byCategory[row.category] = 0;
  }
  for (const c of counts) {
    const row = rows.find((r: { id: string }) => r.id === c.paragraph_id);
    if (row) byCategory[row.category] += 1;
  }

  const paragraph: Paragraph = {
    id: next.id,
    content: next.content,
    difficulty: next.difficulty_score >= 3 ? 'hard' : next.difficulty_score === 2 ? 'medium' : 'easy',
    estimatedDuration: Math.max(3, Math.ceil(next.content.length / 4)),
    category: next.category
  };

  return {
    paragraph,
    progress: {
      total: rows.length,
      completed: completedSet.size,
      byCategory
    }
  };
}

import type { FastifyInstance } from 'fastify';
import type { CorpusListResponse, NextParagraphResponse } from '@xiangxi/shared';
import { getNextParagraph } from '../services/CorporaService.js';
import { db } from '../db.js';

export async function corporaRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { speakerId?: string } }>('/api/corpora/next', async (request) => {
    const speakerId = request.query.speakerId ?? 'default_speaker';
    const result = getNextParagraph(speakerId) as NextParagraphResponse;
    return result;
  });

  app.get<{ Querystring: { limit?: string } }>('/api/corpora/list', async (request) => {
    const limit = Math.min(Number(request.query.limit ?? 100), 500);
    const totalRow = db.prepare('SELECT COUNT(*) as cnt FROM corpora').get() as { cnt: number };
    const rows = db
      .prepare(
        `SELECT id, content, category, difficulty_score, source, created_at
         FROM corpora
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT ?`
      )
      .all(limit) as {
      id: string;
      content: string;
      category: string | null;
      difficulty_score: number | null;
      source: string | null;
      created_at: string | null;
    }[];

    const payload: CorpusListResponse = {
      total: totalRow?.cnt ?? rows.length,
      items: rows.map((row) => ({
        id: row.id,
        content: row.content,
        category: row.category,
        difficultyScore: row.difficulty_score,
        source: row.source,
        createdAt: row.created_at
      }))
    };
    return payload;
  });
}

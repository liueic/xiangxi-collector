import type { FastifyInstance } from 'fastify';
import archiver from 'archiver';
import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../db.js';

interface ExportRow {
  id: string;
  paragraph_id: string;
  speaker_id: string;
  processed_path: string | null;
  status: string | null;
  snr_db: number | null;
  content: string;
}

export async function datasetRoutes(app: FastifyInstance) {
  app.get('/api/dataset/export', async (request, reply) => {
    const query = request.query as { minSnr?: string; speakerId?: string };
    const minSnr = query.minSnr ? Number(query.minSnr) : null;
    const speakerId = query.speakerId ?? null;

    let sql = `
      SELECT r.id, r.paragraph_id, r.speaker_id, r.processed_path, r.status, r.snr_db, c.content
      FROM recordings r
      JOIN corpora c ON c.id = r.paragraph_id
      WHERE r.status = 'raw' AND r.processed_path IS NOT NULL
    `;
    const params: Array<string | number> = [];
    if (speakerId) {
      sql += ' AND r.speaker_id = ?';
      params.push(speakerId);
    }
    if (minSnr !== null && Number.isFinite(minSnr)) {
      sql += ' AND r.snr_db >= ?';
      params.push(minSnr);
    }

    const rows = db.prepare(sql).all(...params) as ExportRow[];

    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', 'attachment; filename="xiangxi_dataset.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      request.log.error(err);
      reply.raw.destroy(err);
    });

    archive.pipe(reply.raw);

    const jsonLines: string[] = [];
    for (const row of rows) {
      if (!row.processed_path) continue;
      const audioPath = resolve(process.cwd(), '../../data', row.processed_path);
      if (!existsSync(audioPath)) continue;

      const audioName = `audio/${row.id}.wav`;
      jsonLines.push(JSON.stringify({ audio: audioName, text: row.content }));
      archive.append(createReadStream(audioPath), { name: audioName });
    }

    archive.append(jsonLines.join('\n') + '\n', { name: 'manifest.jsonl' });
    await archive.finalize();
  });
}

import type { FastifyInstance } from 'fastify';
import { createWriteStream, mkdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';
import { nanoid } from 'nanoid';
import type { UploadResponse } from '@xiangxi/shared';
import { db } from '../db.js';
import { analyzeAudio, getFileSizeKb, standardizeAudio } from '../services/AudioProcessor.js';

const rawDir = resolve(process.cwd(), '../../data/raw');
const processedDir = resolve(process.cwd(), '../../data/processed');
mkdirSync(rawDir, { recursive: true });
mkdirSync(processedDir, { recursive: true });

export async function recordingsRoutes(app: FastifyInstance) {
  app.post('/api/recordings/upload', async (request, reply) => {
    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: 'missing file' };
    }

    const fields = file.fields as Record<string, { value: string }>;
    const paragraphId = fields?.paragraphId?.value ?? 'unknown';
    const speakerId = fields?.speakerId?.value ?? 'default_speaker';
    const retryCount = Number(fields?.retryCount?.value ?? 0);

    const recordingId = nanoid();
    const rawPath = resolve(rawDir, `${recordingId}.webm`);
    await pipeline(file.file, createWriteStream(rawPath));

    const processedPath = resolve(processedDir, `${recordingId}.wav`);
    let status: UploadResponse['status'] = 'success';
    let metrics = {
      dbFS: -60,
      clipping: false,
      silenceDuration: 0,
      peakDbfs: null as number | null,
      snrDb: null as number | null,
      clippingCount: 0
    };

    try {
      await standardizeAudio(rawPath, processedPath);
      const analysis = await analyzeAudio(processedPath);
      metrics = {
        dbFS: analysis.rmsDbfs ?? -60,
        clipping: analysis.clippingCount > 0,
        silenceDuration: analysis.silenceDuration,
        peakDbfs: analysis.peakDbfs,
        snrDb: analysis.snrDb,
        clippingCount: analysis.clippingCount
      };
      if ((analysis.peakDbfs ?? -60) > -1 || analysis.clippingCount > 0) {
        status = 'clipping_detected';
      } else if ((analysis.rmsDbfs ?? -60) < -35) {
        status = 'too_quiet';
      }
    } catch {
      status = 'too_quiet';
    }

    const sizeKb = getFileSizeKb(rawPath);

    db.prepare(
      `INSERT INTO recordings (id, paragraph_id, speaker_id, file_path, processed_path, duration_ms, file_size_kb, snr_db, peak_dbfs, clipping_count, transcript, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      recordingId,
      paragraphId,
      speakerId,
      `raw/${recordingId}.webm`,
      status === 'success' ? `processed/${recordingId}.wav` : null,
      null,
      sizeKb,
      metrics.snrDb,
      metrics.peakDbfs,
      metrics.clippingCount,
      null,
      status === 'success' ? 'raw' : 'discarded'
    );

    const response: UploadResponse = {
      recordingId,
      status,
      fileUrl: `/api/recordings/${recordingId}/download`,
      metrics
    };

    return response;
  });

  app.get<{ Params: { id: string } }>('/api/recordings/:id/download', async (request, reply) => {
    const id = request.params.id;
    const row = db.prepare('SELECT file_path FROM recordings WHERE id = ?').get(id) as { file_path: string };
    if (!row) {
      reply.code(404);
      return { error: 'not found' };
    }
    return reply.sendFile(row.file_path);
  });
}

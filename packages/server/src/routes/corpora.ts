import type { FastifyInstance } from 'fastify';
import type { NextParagraphResponse } from '@xiangxi/shared';
import { getNextParagraph } from '../services/CorporaService.js';

export async function corporaRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { speakerId?: string } }>('/api/corpora/next', async (request) => {
    const speakerId = request.query.speakerId ?? 'default_speaker';
    const result = getNextParagraph(speakerId) as NextParagraphResponse;
    return result;
  });
}

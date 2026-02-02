import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { corporaRoutes } from './routes/corpora.js';
import { recordingsRoutes } from './routes/recordings.js';
import { datasetRoutes } from './routes/dataset.js';
import { corpusRoutes } from './routes/corpus.js';
import { loadCorporaToDb } from './services/CorporaService.js';

const app = Fastify({ logger: true });

await app.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

await app.register(fastifyStatic, {
  root: resolve(process.cwd(), '../../data')
});

loadCorporaToDb();

await app.register(corporaRoutes);
await app.register(recordingsRoutes);
await app.register(datasetRoutes);
await app.register(corpusRoutes);

app.get('/api/health', async () => ({ ok: true }));

const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: '0.0.0.0' });

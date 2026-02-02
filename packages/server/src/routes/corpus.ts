import type { FastifyInstance } from 'fastify';
import type {
  ApproveRequest,
  GenerationRequest,
  GenerationResponse,
  GeneratedSentence
} from '@xiangxi/shared';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { ChenxuPhoneticAnalyzer } from '../utils/phoneticAnalyzer.js';

const CHENXU_SYSTEM_PROMPT = `你是湖南湘西辰溆片方言专家。辰溆片特征：
【音系】保留入声（短促调），知庄章组读如端组（书读如夫），日母读如泥母（人读如len）
【词汇】赶场、背篓、火塘、吊脚楼、崽伢子、妹伢子、摆龙门阵、酸鱼、油茶
【语法】"去"说"克/气"，"吃"说"恰/喫"，"没有"说"冇得"

任务：生成自然口语化的方言句子，用于语音识别训练。`;

const buildUserPrompt = (req: GenerationRequest) => {
  const featureLine = req.specificFeatures?.length
    ? `必须包含音系特征：${req.specificFeatures.join('、')}`
    : '';

  return `主题：${req.topic}
难度：${req.difficulty}
数量：${req.count}句
${featureLine}

要求：
1. 必须包含大量入声字（白、竹、石、十、一、七、吃、日、月、客、百、尺、作）
2. 使用方言词汇替代普通话（如不说"逛街"说"赶场"）
3. 句子长度控制在12-20字，适合朗读
4. 内容贴近湘西农村日常生活（农事、天气、赶集、饮食）

请只输出JSON，格式如下：
{"sentences":[{"text":"...","features":["..."]}]}`;
};

const normalizeEndpoint = (endpoint: string) => {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
};

const extractJson = (content: string) => {
  const trimmed = content.trim();
  if (trimmed.startsWith('```')) {
    const withoutFence = trimmed.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '');
    return JSON.parse(withoutFence.trim());
  }
  return JSON.parse(trimmed);
};

export async function corpusRoutes(app: FastifyInstance) {
  app.post<{ Body: GenerationRequest }>('/api/corpus/generate', async (request, reply) => {
    const { endpoint, apiKey, model, topic, difficulty, count, specificFeatures } = request.body;
    if (!endpoint || !model) {
      reply.status(400);
      return { error: '缺少 endpoint / model' };
    }

    const url = normalizeEndpoint(endpoint);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: CHENXU_SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt({ endpoint, apiKey, model, topic, difficulty, count, specificFeatures }) }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      reply.status(500);
      return { error: 'LLM调用失败', detail };
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content;
    if (!content) {
      reply.status(500);
      return { error: 'LLM未返回内容' };
    }

    let parsed: any;
    try {
      parsed = extractJson(content);
    } catch (error) {
      reply.status(500);
      return { error: 'JSON解析失败', detail: String(error) };
    }

    const rawSentences = Array.isArray(parsed) ? parsed : parsed.sentences ?? [];
    const analyzed: GeneratedSentence[] = rawSentences
      .map((item: any) => {
        const text = typeof item === 'string' ? item : item?.text;
        if (!text || typeof text !== 'string') return null;
        const analysis = ChenxuPhoneticAnalyzer.analyze(text);
        return {
          id: nanoid(),
          text,
          features: Array.isArray(item?.features) ? item.features : undefined,
          analysis,
          heatmap: ChenxuPhoneticAnalyzer.generateHeatmap(text),
          status: 'pending',
          topic,
          difficulty
        } satisfies GeneratedSentence;
      })
      .filter(Boolean) as GeneratedSentence[];

    analyzed.sort((a, b) => b.analysis.score - a.analysis.score);

    const insert = db.prepare(
      'INSERT INTO generated_corpus (id, text, topic, difficulty, analysis_json, status) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const insertMany = db.transaction((rows: GeneratedSentence[]) => {
      for (const row of rows) {
        insert.run(
          row.id,
          row.text,
          row.topic ?? topic,
          row.difficulty ?? difficulty,
          JSON.stringify(row.analysis),
          row.status
        );
      }
    });
    insertMany(analyzed);

    const summary = {
      total: analyzed.length,
      highQuality: analyzed.filter((item) => item.analysis.score >= 60).length,
      avgRushengDensity:
        analyzed.length === 0
          ? 0
          : analyzed.reduce((sum, item) => sum + item.analysis.rushengDensity, 0) / analyzed.length
    };

    const payload: GenerationResponse = {
      success: true,
      data: analyzed,
      summary
    };
    return payload;
  });

  app.post<{ Body: ApproveRequest }>('/api/corpus/approve', async (request) => {
    const { ids } = request.body ?? { ids: [] };
    if (!ids?.length) return { approved: 0 };

    const select = db.prepare('SELECT id, text, topic, difficulty FROM generated_corpus WHERE id = ?');
    const insert = db.prepare(
      'INSERT OR REPLACE INTO corpora (id, title, content, category, difficulty_score, source) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const update = db.prepare('UPDATE generated_corpus SET status = ? WHERE id = ?');

    const tx = db.transaction((rows: string[]) => {
      let approved = 0;
      for (const id of rows) {
        const row = select.get(id) as { id: string; text: string; topic: string; difficulty: string } | undefined;
        if (!row) continue;
        const difficultyScore = row.difficulty === 'hard' ? 3 : row.difficulty === 'medium' ? 2 : 1;
        insert.run(row.id, row.topic, row.text, row.topic, difficultyScore, 'llm_generated');
        update.run('approved', row.id);
        approved += 1;
      }
      return approved;
    });

    const approved = tx(ids);
    return { approved };
  });

  app.post<{ Body: ApproveRequest }>('/api/corpus/reject', async (request) => {
    const { ids } = request.body ?? { ids: [] };
    if (!ids?.length) return { rejected: 0 };

    const update = db.prepare('UPDATE generated_corpus SET status = ? WHERE id = ?');
    const tx = db.transaction((rows: string[]) => {
      let rejected = 0;
      for (const id of rows) {
        update.run('rejected', id);
        rejected += 1;
      }
      return rejected;
    });
    const rejected = tx(ids);
    return { rejected };
  });
}

import { useEffect, useMemo, useState } from 'react';
import type {
  ApproveRequest,
  GeneratedSentence,
  GenerationResponse,
  HeatmapData,
  Difficulty
} from '@xiangxi/shared';

const STORAGE_KEY = 'xiangxi_llm_config';

interface LlmConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

const defaultConfig: LlmConfig = {
  endpoint: 'https://api.openai.com',
  apiKey: '',
  model: 'gpt-4o-mini'
};

const heatmapColor = (item: HeatmapData) => {
  switch (item.type) {
    case 'rusheng':
      return 'var(--heat-rusheng)';
    case 'zhuzhuang':
      return 'var(--heat-zhuzhuang)';
    case 'dialect':
      return 'var(--heat-dialect)';
    default:
      return 'transparent';
  }
};

export default function CorpusGenerator() {
  const [config, setConfig] = useState<LlmConfig>(defaultConfig);
  const [topic, setTopic] = useState('赶集');
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  const [count, setCount] = useState(8);
  const [featureText, setFeatureText] = useState('入声');
  const [autoApprove, setAutoApprove] = useState(true);
  const [candidates, setCandidates] = useState<GeneratedSentence[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        setConfig({ ...defaultConfig, ...JSON.parse(cached) });
      } catch {
        setConfig(defaultConfig);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const featureList = useMemo(
    () =>
      featureText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [featureText]
  );

  const generate = async () => {
    setLoading(true);
    setStatus('生成中...');
    const response = await fetch('/api/corpus/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...config,
        topic,
        difficulty,
        count,
        specificFeatures: featureList,
        autoApprove
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      setStatus(`生成失败: ${detail}`);
      setLoading(false);
      return;
    }

    const data = (await response.json()) as GenerationResponse;
    setCandidates(data.data);
    setStatus(`生成完成：${data.summary.total}句，高质量${data.summary.highQuality}句`);
    setLoading(false);
  };

  const approve = async (ids: string[]) => {
    const body: ApproveRequest = { ids };
    const response = await fetch('/api/corpus/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      setStatus('入库失败');
      return;
    }
    setCandidates((prev) => prev.map((item) => (ids.includes(item.id) ? { ...item, status: 'approved' } : item)));
    setStatus(`已入库 ${ids.length} 条`);
  };

  const reject = async (ids: string[]) => {
    const response = await fetch('/api/corpus/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (!response.ok) {
      setStatus('丢弃失败');
      return;
    }
    setCandidates((prev) => prev.map((item) => (ids.includes(item.id) ? { ...item, status: 'rejected' } : item)));
    setStatus(`已丢弃 ${ids.length} 条`);
  };

  const approveHighQuality = () => {
    const ids = candidates.filter((item) => item.analysis.score >= 60).map((item) => item.id);
    if (!ids.length) {
      setStatus('没有达到阈值的语料');
      return;
    }
    approve(ids);
  };

  return (
    <div className="card">
      <div className="header">
        <div className="title">语料生成</div>
        <div className="subtitle">LLM 生成 → 音系分析 → 人工入库</div>
      </div>

      <div className="generator-grid">
        <div className="input-row">
          <span>Endpoint</span>
          <input
            type="text"
            value={config.endpoint}
            onChange={(event) => setConfig((prev) => ({ ...prev, endpoint: event.target.value }))}
            placeholder="https://api.openai.com 或 http://localhost:11434"
          />
        </div>
        <div className="input-row">
          <span>模型</span>
          <input
            type="text"
            value={config.model}
            onChange={(event) => setConfig((prev) => ({ ...prev, model: event.target.value }))}
            placeholder="gpt-4o / gpt-4o-mini / qwen2.5:14b"
          />
        </div>
        <div className="input-row">
          <span>API Key</span>
          <input
            type="password"
            value={config.apiKey}
            onChange={(event) => setConfig((prev) => ({ ...prev, apiKey: event.target.value }))}
            placeholder="可留空用于本地模型"
          />
        </div>
      </div>

      <div className="generator-grid" style={{ marginTop: 12 }}>
        <div className="input-row">
          <span>主题</span>
          <input type="text" value={topic} onChange={(event) => setTopic(event.target.value)} />
        </div>
        <div className="input-row">
          <span>难度</span>
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>
            <option value="easy">入门</option>
            <option value="medium">中等</option>
            <option value="hard">困难</option>
          </select>
        </div>
        <div className="input-row">
          <span>数量</span>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </div>
        <div className="input-row">
          <span>特征</span>
          <input
            type="text"
            value={featureText}
            onChange={(event) => setFeatureText(event.target.value)}
            placeholder="入声,知组字"
          />
        </div>
        <label className="input-row">
          <span>自动入库</span>
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(event) => setAutoApprove(event.target.checked)}
          />
          <span className="status">{autoApprove ? '已开启' : '关闭'}</span>
        </label>
      </div>

      <div className="controls" style={{ marginTop: 12 }}>
        <button className="primary" onClick={generate} disabled={loading}>
          生成语料
        </button>
        <button className="secondary" onClick={approveHighQuality} disabled={!candidates.length}>
          入库高分
        </button>
      </div>

      <div className="status" style={{ marginTop: 8 }}>
        {status || '等待生成'}
      </div>

      <div className="candidate-list">
        {candidates.map((item) => (
          <div key={item.id} className={`candidate ${item.status}`}>
            <div className="candidate-header">
              <div className="candidate-text">{item.text}</div>
              <span className="chip">得分 {item.analysis.score}</span>
            </div>
            <div className="heatmap">
              {item.heatmap.map((cell) => (
                <span
                  key={`${item.id}-${cell.index}`}
                  style={{ background: heatmapColor(cell) }}
                  title={`${cell.char} ${cell.type}`}
                >
                  {cell.char}
                </span>
              ))}
            </div>
            <div className="candidate-meta">
              入声密度 {(item.analysis.rushengDensity * 100).toFixed(1)}% · 方言词{' '}
              {item.analysis.dialectWords.join('、') || '无'} · 特征{' '}
              {item.analysis.features.slice(0, 3).join('、') || '无'}
            </div>
            <div className="candidate-actions">
              <button className="secondary" onClick={() => approve([item.id])} disabled={item.status !== 'pending'}>
                入库
              </button>
              <button className="secondary" onClick={() => reject([item.id])} disabled={item.status !== 'pending'}>
                丢弃
              </button>
              <span className="status">{item.status === 'approved' ? '已入库' : item.status === 'rejected' ? '已丢弃' : '待处理'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

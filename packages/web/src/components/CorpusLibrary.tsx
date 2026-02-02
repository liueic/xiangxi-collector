import { useEffect, useState } from 'react';
import type { CorpusListResponse } from '@xiangxi/shared';

const formatTime = (value: string | null) => {
  if (!value) return '未知时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function CorpusLibrary() {
  const [items, setItems] = useState<CorpusListResponse['items']>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const response = await fetch('/api/corpora/list?limit=120');
    if (!response.ok) {
      setLoading(false);
      return;
    }
    const data = (await response.json()) as CorpusListResponse;
    setItems(data.items);
    setTotal(data.total);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card">
      <div className="header">
        <div className="title">已入库语料</div>
        <div className="subtitle">共 {total} 条</div>
      </div>
      <div className="controls" style={{ marginTop: 4 }}>
        <button className="secondary" onClick={load} disabled={loading}>
          刷新列表
        </button>
      </div>
      <div className="list">
        {items.map((item) => (
          <div key={item.id} className="list-item">
            <div className="list-main">{item.content}</div>
            <div className="list-meta">
              {item.category ?? '未分类'} · {item.source ?? 'unknown'} · {formatTime(item.createdAt)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

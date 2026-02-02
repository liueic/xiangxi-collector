import { useEffect, useState } from 'react';
import type { RecordingListResponse } from '@xiangxi/shared';

const formatTime = (value: string | null) => {
  if (!value) return '未知时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function RecordingLog() {
  const [items, setItems] = useState<RecordingListResponse['items']>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const response = await fetch('/api/recordings/list?limit=120');
    if (!response.ok) {
      setLoading(false);
      return;
    }
    const data = (await response.json()) as RecordingListResponse;
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
        <div className="title">跟读记录</div>
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
            <div className="list-main">{item.paragraphContent ?? item.paragraphId}</div>
            <div className="list-meta">
              {formatTime(item.createdAt)} · 说话人 {item.speakerId ?? 'unknown'} · 状态 {item.status ?? 'unknown'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

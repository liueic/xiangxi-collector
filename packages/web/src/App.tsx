import { useEffect, useMemo, useState } from 'react';
import type { NextParagraphResponse, UploadResponse } from '@xiangxi/shared';
import PromptReader from './components/PromptReader';
import WaveformVisualizer from './components/WaveformVisualizer';
import { useRecorder } from './hooks/useRecorder';
import { useAudioAnalysis } from './hooks/useAudioAnalysis';

export default function App() {
  const [paragraph, setParagraph] = useState<NextParagraphResponse['paragraph'] | null>(null);
  const [progress, setProgress] = useState<NextParagraphResponse['progress'] | null>(null);
  const [speakerId, setSpeakerId] = useState('local_speaker');
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [lastMetrics, setLastMetrics] = useState<UploadResponse['metrics'] | null>(null);
  const [fontSize, setFontSize] = useState(22);
  const [lineHeight, setLineHeight] = useState(1.9);

  const recorder = useRecorder();
  const analysis = useAudioAnalysis(recorder.stream);

  const meterWidth = useMemo(() => {
    const normalized = (analysis.dbfs + 60) / 60;
    return Math.min(100, Math.max(0, Math.round(normalized * 100)));
  }, [analysis.dbfs]);

  const meterColor = analysis.dbfs > -12 ? 'var(--good)' : analysis.dbfs > -24 ? 'var(--warn)' : 'var(--bad)';
  const playbackUrl = useMemo(() => {
    if (!recorder.blob) return '';
    return URL.createObjectURL(recorder.blob);
  }, [recorder.blob]);

  useEffect(() => {
    return () => {
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    };
  }, [playbackUrl]);

  const loadNext = async () => {
    const response = await fetch(`/api/corpora/next?speakerId=${encodeURIComponent(speakerId)}`);
    const data = (await response.json()) as NextParagraphResponse;
    setParagraph(data.paragraph);
    setProgress(data.progress);
  };

  useEffect(() => {
    loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakerId]);

  const handleUpload = async () => {
    if (!recorder.blob || !paragraph) return;
    setUploading(true);
    setStatus('上传中...');

    const form = new FormData();
    form.append('audio', recorder.blob, 'recording.webm');
    form.append('paragraphId', paragraph.id);
    form.append('speakerId', speakerId);
    form.append('retryCount', '0');

    const response = await fetch('/api/recordings/upload', {
      method: 'POST',
      body: form
    });

    const result = (await response.json()) as UploadResponse;
    setStatus(`上传完成: ${result.status}`);
    setLastMetrics(result.metrics);
    recorder.reset();
    await loadNext();
    setUploading(false);
  };

  const handleExport = async () => {
    const response = await fetch('/api/dataset/export');
    if (!response.ok) {
      setStatus('导出失败');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'xiangxi_dataset.zip';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <div className="card">
        <div className="header">
          <div className="title">湘语采集器</div>
          <div className="subtitle">开始录音，朗读提示文本</div>
        </div>
        <PromptReader paragraph={paragraph} fontSize={fontSize} lineHeight={lineHeight} />
        <div className="controls">
          <button className="primary" onClick={recorder.start} disabled={recorder.isRecording}>
            开始录音
          </button>
          <button className="secondary" onClick={recorder.stop} disabled={!recorder.isRecording}>
            停止录音
          </button>
          <button className="secondary" onClick={handleUpload} disabled={!recorder.blob || uploading}>
            上传本段
          </button>
          <button className="secondary" onClick={handleExport}>
            导出训练集
          </button>
        </div>
        {recorder.blob ? (
          <div style={{ marginTop: 12 }}>
            <audio controls src={playbackUrl} />
          </div>
        ) : null}
        <div className="status">{status || '准备就绪'}</div>
      </div>

      <div className="card">
        <div className="header">
          <div className="title">录音与阅读设置</div>
          <div className="subtitle">音量监测 / 阅读参数</div>
        </div>
        <div className="input-row">
          <span>说话人ID</span>
          <input
            type="text"
            value={speakerId}
            onChange={(event) => setSpeakerId(event.target.value)}
          />
        </div>
        <div className="input-row" style={{ marginTop: 10 }}>
          <span>字体大小</span>
          <input
            type="range"
            min={18}
            max={34}
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.target.value))}
          />
          <span className="status">{fontSize}px</span>
        </div>
        <div className="input-row" style={{ marginTop: 6 }}>
          <span>行高</span>
          <input
            type="range"
            min={16}
            max={26}
            value={Math.round(lineHeight * 10)}
            onChange={(event) => setLineHeight(Number(event.target.value) / 10)}
          />
          <span className="status">{lineHeight.toFixed(1)}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="meter">
            <span style={{ width: `${meterWidth}%`, background: meterColor }} />
          </div>
          <div className="status">当前电平: {analysis.dbfs.toFixed(1)} dBFS</div>
        </div>
        <WaveformVisualizer waveform={analysis.waveform} />
        {lastMetrics ? (
          <div className="status">
            质检: RMS {lastMetrics.dbFS.toFixed(1)} dBFS / Peak{' '}
            {lastMetrics.peakDbfs?.toFixed(1) ?? '--'} dBFS / SNR{' '}
            {lastMetrics.snrDb?.toFixed(1) ?? '--'} dB / 静音{' '}
            {lastMetrics.silenceDuration.toFixed(2)}s / 削波{' '}
            {lastMetrics.clippingCount ?? 0}
          </div>
        ) : null}
        {progress ? (
          <div className="status">
            已完成 {progress.completed}/{progress.total} 段
          </div>
        ) : null}
      </div>
    </div>
  );
}

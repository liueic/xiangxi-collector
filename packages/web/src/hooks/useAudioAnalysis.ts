import { useEffect, useRef, useState } from 'react';

export function useAudioAnalysis(stream: MediaStream | null) {
  const [dbfs, setDbfs] = useState(-60);
  const [waveform, setWaveform] = useState<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream) return;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    setWaveform(data);

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const db = 20 * Math.log10(rms || 0.0001);
      setDbfs(Math.max(-60, Math.min(0, db)));
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      analyser.disconnect();
      audioContext.close();
    };
  }, [stream]);

  return { dbfs, waveform };
}

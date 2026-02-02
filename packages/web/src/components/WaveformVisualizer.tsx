import { useEffect, useRef } from 'react';

interface Props {
  waveform: Uint8Array | null;
}

export default function WaveformVisualizer({ waveform }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveform) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#c6532c';
      ctx.beginPath();

      const slice = width / waveform.length;
      for (let i = 0; i < waveform.length; i += 1) {
        const v = waveform[i] / 255;
        const y = v * height;
        if (i === 0) {
          ctx.moveTo(0, y);
        } else {
          ctx.lineTo(i * slice, y);
        }
      }
      ctx.stroke();
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [waveform]);

  return <canvas ref={canvasRef} className="wave" width={600} height={100} />;
}

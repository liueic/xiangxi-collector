import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { statSync } from 'node:fs';
import { spawn } from 'node:child_process';

ffmpeg.setFfmpegPath(ffmpegPath ?? '');

export async function standardizeAudio(inputPath: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .audioFilters(['highpass=f=80'])
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
}

export function getFileSizeKb(path: string) {
  return Math.ceil(statSync(path).size / 1024);
}

export interface AudioQualityMetrics {
  peakDbfs: number | null;
  rmsDbfs: number | null;
  clippingCount: number;
  silenceDuration: number;
  snrDb: number | null;
}

function parseNumber(value: string | undefined) {
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export async function analyzeAudio(path: string): Promise<AudioQualityMetrics> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i',
      path,
      '-af',
      [
        'astats=metadata=1:reset=1',
        'ametadata=print:key=lavfi.astats.Overall.Peak_level',
        'ametadata=print:key=lavfi.astats.Overall.RMS_level',
        'ametadata=print:key=lavfi.astats.Overall.Clipped_samples',
        'silencedetect=noise=-40dB:d=0.3'
      ].join(','),
      '-f',
      'null',
      '-'
    ];
    const child = spawn(ffmpegPath ?? 'ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && code !== 1) {
        reject(new Error(`ffmpeg exited with code ${code}`));
        return;
      }

      const peakMatch = stderr.match(/lavfi\.astats\.Overall\.Peak_level=([-\d.]+)/);
      const rmsMatch = stderr.match(/lavfi\.astats\.Overall\.RMS_level=([-\d.]+)/);
      const clipMatch = stderr.match(/lavfi\.astats\.Overall\.Clipped_samples=([-\d.]+)/);

      let silenceDuration = 0;
      const silenceRegex = /silence_duration:\s*([\d.]+)/g;
      let silenceResult = silenceRegex.exec(stderr);
      while (silenceResult) {
        const value = Number(silenceResult[1]);
        if (Number.isFinite(value)) silenceDuration += value;
        silenceResult = silenceRegex.exec(stderr);
      }

      const peakDbfs = parseNumber(peakMatch?.[1]);
      const rmsDbfs = parseNumber(rmsMatch?.[1]);
      const clippingCount = Math.max(0, Math.round(Number(clipMatch?.[1] ?? 0)));
      // Approximate SNR using silence threshold (-40 dB) as noise floor.
      const snrDb = rmsDbfs !== null ? rmsDbfs - -40 : null;

      resolve({
        peakDbfs,
        rmsDbfs,
        clippingCount,
        silenceDuration,
        snrDb
      });
    });
  });
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Paragraph {
  id: string;
  content: string;
  phoneticHint?: string;
  difficulty: Difficulty;
  estimatedDuration: number;
  category?: string;
}

export interface PromptProgress {
  total: number;
  completed: number;
  byCategory: Record<string, number>;
}

export interface AudioMetrics {
  dbFS: number;
  clipping: boolean;
  silenceDuration: number;
  durationMs?: number;
  peakDbfs?: number;
  snrDb?: number;
  clippingCount?: number;
}

export interface UploadResponse {
  recordingId: string;
  status: 'success' | 'clipping_detected' | 'too_quiet';
  fileUrl: string;
  metrics: AudioMetrics;
}

export interface NextParagraphResponse {
  paragraph: Paragraph;
  progress: PromptProgress;
}

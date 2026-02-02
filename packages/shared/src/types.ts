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

export type HeatmapType = 'rusheng' | 'zhuzhuang' | 'dialect' | 'normal';

export interface HeatmapData {
  index: number;
  char: string;
  type: HeatmapType;
  intensity: number;
}

export interface PhoneticAnalysis {
  charCount: number;
  rushengCount: number;
  rushengDensity: number;
  zhuzhuangCount: number;
  dialectWords: string[];
  score: number;
  features: string[];
}

export interface GeneratedSentence {
  id: string;
  text: string;
  features?: string[];
  analysis: PhoneticAnalysis;
  heatmap: HeatmapData[];
  status: 'pending' | 'approved' | 'rejected';
  topic?: string;
  difficulty?: Difficulty;
}

export interface GenerationRequest {
  endpoint: string;
  apiKey: string;
  model: string;
  topic: string;
  difficulty: Difficulty;
  count: number;
  specificFeatures?: string[];
}

export interface GenerationResponse {
  success: boolean;
  data: GeneratedSentence[];
  summary: {
    total: number;
    highQuality: number;
    avgRushengDensity: number;
  };
}

export interface ApproveRequest {
  ids: string[];
}

export interface ApproveResponse {
  approved: number;
}

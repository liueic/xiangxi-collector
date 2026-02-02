import type { HeatmapData, PhoneticAnalysis } from '@xiangxi/shared';

export class ChenxuPhoneticAnalyzer {
  private static readonly RUSHENG_CHARS = new Set([
    '白', '竹', '石', '十', '一', '七', '吃', '日', '月', '客', '百', '尺', '作', '不', '出', '德',
    '发', '国', '活', '急', '脚', '渴', '力', '六', '没', '木', '入', '实', '室', '叔', '熟', '术',
    '束', '速', '宿', '塔', '铁', '托', '屋', '夕', '息', '习', '席', '赤', '色', '识', '失', '湿',
    '拾', '舌', '设', '涉', '射', '社', '胜', '诗', '狮', '施', '什', '食', '蚀'
  ]);

  private static readonly ZHUZHUANG_CHARS = new Set([
    '知', '张', '中', '吹', '书', '穿', '水', '树', '说', '春', '船', '山', '师', '诗', '失',
    '狮', '施', '湿', '十', '石', '时', '识', '实', '拾', '食', '蚀', '上', '少', '收', '手', '受'
  ]);

  private static readonly DIALECT_WORDS: Record<string, string> = {
    '赶场': '赶集',
    '背篓': '背筐',
    '火塘': '火炉',
    '吊脚楼': '吊脚楼',
    '崽伢子': '男孩子',
    '妹伢子': '女孩子',
    '摆龙门阵': '聊天',
    '恰': '吃',
    '克': '去',
    '冇得': '没有'
  };

  static analyze(text: string): PhoneticAnalysis {
    const chars = text.split('');
    const rushengChars = chars.filter((c) => this.RUSHENG_CHARS.has(c));
    const rushengDensity = chars.length ? rushengChars.length / chars.length : 0;
    const zhuzhuangChars = chars.filter((c) => this.ZHUZHUANG_CHARS.has(c));
    const dialectWords = Object.keys(this.DIALECT_WORDS).filter((word) => text.includes(word));

    let score = 0;
    if (rushengDensity > 0.15) score += 40;
    else if (rushengDensity > 0.1) score += 20;
    if (zhuzhuangChars.length > 0) score += 20;
    if (dialectWords.length > 0) score += 20;
    if (chars.length >= 12 && chars.length <= 20) score += 20;
    score = Math.min(100, score);

    return {
      charCount: chars.length,
      rushengCount: rushengChars.length,
      rushengDensity: Number(rushengDensity.toFixed(3)),
      zhuzhuangCount: zhuzhuangChars.length,
      dialectWords,
      score,
      features: [
        ...rushengChars.map((c) => `入声:${c}`),
        ...zhuzhuangChars.map((c) => `知组:${c}`),
        ...dialectWords.map((w) => `方言:${w}`)
      ]
    };
  }

  static generateHeatmap(text: string): HeatmapData[] {
    return text.split('').map((char, index) => {
      if (this.RUSHENG_CHARS.has(char)) {
        return { index, char, type: 'rusheng', intensity: 1 };
      }
      if (this.ZHUZHUANG_CHARS.has(char)) {
        return { index, char, type: 'zhuzhuang', intensity: 0.8 };
      }
      if (Object.keys(this.DIALECT_WORDS).some((word) => word.includes(char))) {
        return { index, char, type: 'dialect', intensity: 0.6 };
      }
      return { index, char, type: 'normal', intensity: 0 };
    });
  }
}

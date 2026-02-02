# Xiangxi-Collector（湘语采集器）

一个轻量、开源的湘西方言语音采集工具，用于 Whisper 微调数据准备。提供网页录音、阅读面板、质检与一键导出训练集。

## 功能

- 网页端录音，实时音量/波形监测
- 面向小说/教材等长文本的阅读面板
- 自动标准化音频（16 kHz、单声道、16-bit PCM WAV）
- 录音质检：削波、静音时长、近似 SNR
- 一键导出训练集 zip（`manifest.jsonl` + 音频文件）

## 技术栈

- 前端：React + Vite
- 后端：Fastify + TypeScript
- 音频：MediaRecorder + FFmpeg
- 数据库：SQLite（better-sqlite3）

## 项目结构

```
xiangxi-collector/
├── packages/
│   ├── web/        # 前端
│   ├── server/     # 后端
│   └── shared/     # 共享类型
├── corpora/        # 语料 JSON
├── data/           # 录音 + 数据库（已 gitignore）
└── README.md
```

## 快速开始

1) 安装依赖

```
npm install
```

2) 同时启动前后端

```
npm run dev
```

- 前端：http://localhost:3000
- 后端：http://localhost:3001

## 录音流程

1) 打开网页并允许麦克风权限
2) 阅读面板中的段落并录音
3) 上传本段
4) 点击“导出训练集”下载 zip

## 导出数据格式

导出的 zip 结构如下：

```
manifest.jsonl
audio/
  <recordingId>.wav
```

`manifest.jsonl` 每行一个样本：

```json
{"audio":"audio/xxx.wav","text":"对应文本"}
```

音频已标准化为 16 kHz、单声道、16-bit PCM WAV。

## API

- `GET /api/corpora/next?speakerId=...`
- `POST /api/recordings/upload`（multipart form）
- `GET /api/dataset/export?minSnr=...&speakerId=...`

## 注意事项

- `data/` 已忽略进 git，用来存放录音与数据库。
- 替换 `corpora/*.json` 即可使用自己的文本。

## License

MIT

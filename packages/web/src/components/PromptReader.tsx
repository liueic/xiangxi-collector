import type { Paragraph } from '@xiangxi/shared';

interface Props {
  paragraph: Paragraph | null;
  fontSize: number;
  lineHeight: number;
}

export default function PromptReader({ paragraph, fontSize, lineHeight }: Props) {
  if (!paragraph) {
    return <div className="reader">正在加载段落...</div>;
  }

  return (
    <div className="reader">
      <div className="reader-meta">
        <span className="tag">{paragraph.category ?? 'general'}</span>
        <span className="meta-text">段落: {paragraph.id}</span>
        <span className="meta-text">难度: {paragraph.difficulty}</span>
      </div>
      <div className="reader-body" style={{ fontSize, lineHeight }}>
        {paragraph.content}
      </div>
    </div>
  );
}

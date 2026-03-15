import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function AIInsights({ insights }: { insights: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none rounded-md bg-muted px-4 py-3 leading-relaxed">
      <Markdown remarkPlugins={[remarkGfm]}>{insights}</Markdown>
    </div>
  );
}

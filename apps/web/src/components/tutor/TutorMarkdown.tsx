import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

// Markdown with LaTeX the way the notes write it ($...$, $$...$$). Loaded lazily through
// `Markdown` (./Markdown.tsx) so react-markdown and KaTeX (~300 KB) only come with the tutor
// (study-tutor-game D36). Raw HTML in a message is not rendered (react-markdown's default).
export default function TutorMarkdown({ text }: { text: string }) {
  return (
    <div className="tutor-markdown">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

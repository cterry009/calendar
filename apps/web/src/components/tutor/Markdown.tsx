import { lazy, Suspense } from 'react';

const TutorMarkdown = lazy(() => import('./TutorMarkdown'));

/** Rendered markdown + LaTeX; the plain text shows while the renderer loads. */
export function Markdown({ text }: { text: string }) {
  return (
    <Suspense fallback={<div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>}>
      <TutorMarkdown text={text} />
    </Suspense>
  );
}

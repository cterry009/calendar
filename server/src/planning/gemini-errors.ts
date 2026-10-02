/** Gemini's errors carry the whole JSON body; the status and the first sentence are enough. */
export function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  try {
    const { error: e } = JSON.parse(message) as { error: { code: number; message: string } };
    return `${e.code} ${e.message.split('. ')[0]}`;
  } catch {
    return message.slice(0, 200);
  }
}

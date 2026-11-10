import { useEffect, useRef, useState } from 'react';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useNativeFieldStyle } from '../../hooks/useNativeFieldStyle';
import { apiFetch, ApiError } from '../../lib/api';
import { Markdown } from '../tutor/Markdown';

// 2026-11-10: the project's AI chat. The server runs Claude with the calendar bridge, so what it saves
// (log entries, objectives, tasks) is in the app and every other Claude chat sees it. The conversation
// itself is kept on this device and continues on the server's side by its session id.

interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;
  at: string;
}
interface ChatState {
  sessionId: string | null;
  messages: Message[];
}

const key = (projectId: string) => `calendar.projectChat.${projectId}`;

function load(projectId: string): ChatState {
  try {
    const raw = window.localStorage.getItem(key(projectId));
    if (raw) return JSON.parse(raw) as ChatState;
  } catch {
    /* fresh */
  }
  return { sessionId: null, messages: [] };
}

export function ProjectChat({ projectId, onSaved }: { projectId: string; onSaved: () => void }) {
  const field = useNativeFieldStyle();
  const [chat, setChat] = useState<ChatState>(() => load(projectId));
  const [draft, setDraft] = useState('');
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => setChat(load(projectId)), [projectId]);
  useEffect(() => {
    try {
      window.localStorage.setItem(key(projectId), JSON.stringify({ ...chat, messages: chat.messages.slice(-60) }));
    } catch {
      /* per device */
    }
  }, [chat, projectId]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [chat.messages.length, since]);
  useEffect(() => {
    if (since === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [since]);

  async function send() {
    const text = draft.trim();
    if (!text || since !== null) return;
    setDraft('');
    const at = new Date().toISOString();
    setChat((c) => ({ ...c, messages: [...c.messages, { role: 'user', text, at }] }));
    setSince(Date.now());
    setNow(Date.now());
    try {
      const res = await apiFetch<{ reply: string; sessionId: string }>(`/projects/${projectId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: text, sessionId: chat.sessionId ?? undefined }),
      });
      setChat((c) => ({ sessionId: res.sessionId, messages: [...c.messages, { role: 'assistant', text: res.reply, at: new Date().toISOString() }] }));
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'No se pudo hablar con el chat.';
      setChat((c) => ({ ...c, messages: [...c.messages, { role: 'system', text: msg, at: new Date().toISOString() }] }));
    } finally {
      setSince(null);
    }
  }

  return (
    <YStack gap="$3">
      <div ref={scroller} style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {chat.messages.length === 0 ? (
          <Paragraph margin={0} color="$muted" size="$2">
            Pregúntale por el proyecto o pídele que registre un avance, marque un objetivo o cree una tarea. Lo que guarde queda en la app y lo ven tus demás chats de Claude.
          </Paragraph>
        ) : null}
        {chat.messages.map((m, i) => (
          <YStack
            key={`${m.at}-${i}`}
            alignSelf={m.role === 'user' ? 'flex-end' : 'stretch'}
            maxWidth={m.role === 'user' ? '85%' : '100%'}
            padding="$2"
            paddingHorizontal="$3"
            borderRadius="$4"
            backgroundColor={m.role === 'user' ? '$accentBackground' : m.role === 'system' ? 'transparent' : '$surfaceHover'}
          >
            {m.role === 'system' ? (
              <Text fontSize="$2" color="$danger">
                {m.text}
              </Text>
            ) : (
              <Markdown text={m.text} />
            )}
          </YStack>
        ))}
        {since !== null ? (
          <Text color="$muted" fontSize="$2">
            Pensando… {Math.round((now - since) / 1000)} s
          </Text>
        ) : null}
      </div>
      <XStack gap="$2" alignItems="flex-end">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          disabled={since !== null}
          placeholder="Escribe… Enter envía, Shift+Enter salta línea."
          style={{ ...field, flex: 1, borderRadius: 8, padding: 10, resize: 'vertical' }}
        />
        <AppButton variant="primary" disabled={since !== null || !draft.trim()} onPress={() => void send()}>
          Enviar
        </AppButton>
      </XStack>
      {chat.messages.length ? (
        <AppButton variant="ghost" size="$2" alignSelf="flex-start" disabled={since !== null} onPress={() => setChat({ sessionId: null, messages: [] })}>
          Nueva conversación
        </AppButton>
      ) : null}
    </YStack>
  );
}

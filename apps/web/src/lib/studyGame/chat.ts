import type { TutorAttempt, TutorExercise, TutorTurnResult } from './tutorApi';

// The tutor conversation of one note section (study-tutor-game D39). It lives in the panel's state
// and in sessionStorage, so reloading the app mid-block keeps the chat; a new browser session starts
// a new one (the server's Claude session would be gone after a restart anyway).

export interface ChatMessage {
  role: 'user' | 'tutor' | 'system';
  text: string;
  at: string;
  /** The grade this tutor message carried. */
  attempt?: TutorAttempt;
}

export interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  current: TutorExercise | null;
  /** The next turn asks Claude for a generated exercise at this b. */
  generateAt: number | null;
  /** The last grade, while it can still be corrected. */
  lastAttempt: TutorAttempt | null;
}

export const EMPTY_CHAT: ChatState = {
  sessionId: null,
  messages: [],
  current: null,
  generateAt: null,
  lastAttempt: null,
};

export function chatKey(noteCode: string, section: string): string {
  return `tutor-chat:${noteCode}§${section}`;
}

export function loadChat(noteCode: string, section: string, storage?: Storage): ChatState {
  try {
    const raw = (storage ?? window.sessionStorage).getItem(chatKey(noteCode, section));
    return raw ? { ...EMPTY_CHAT, ...(JSON.parse(raw) as Partial<ChatState>) } : EMPTY_CHAT;
  } catch {
    return EMPTY_CHAT;
  }
}

export function saveChat(
  noteCode: string,
  section: string,
  chat: ChatState,
  storage?: Storage,
): void {
  try {
    (storage ?? window.sessionStorage).setItem(chatKey(noteCode, section), JSON.stringify(chat));
  } catch {
    // Private mode or full storage: the chat just won't survive a reload.
  }
}

export function withUserMessage(
  chat: ChatState,
  text: string,
  at = new Date().toISOString(),
): ChatState {
  return { ...chat, messages: [...chat.messages, { role: 'user', text, at }] };
}

export function withSystemMessage(
  chat: ChatState,
  text: string,
  at = new Date().toISOString(),
): ChatState {
  return { ...chat, messages: [...chat.messages, { role: 'system', text, at }] };
}

export function withTurn(
  chat: ChatState,
  turn: TutorTurnResult,
  at = new Date().toISOString(),
): ChatState {
  const messages: ChatMessage[] = [
    ...chat.messages,
    ...turn.warnings.map((text) => ({ role: 'system' as const, text, at })),
    { role: 'tutor', text: turn.mensaje, at, attempt: turn.attempt ?? undefined },
  ];
  return {
    sessionId: turn.sessionId,
    messages,
    current: turn.current,
    generateAt: turn.generateAt,
    lastAttempt: turn.attempt ?? chat.lastAttempt,
  };
}

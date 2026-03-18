import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const STORE_PATH = process.env['CONVERSATION_STORE_PATH'] ?? '/tmp/telegram-conversations.json';

export interface ConversationEntry {
  issueId: string;
  chatId: number;
  username: string;
  lastSeenCommentId: string | null;
  updatedAt: string;
}

type Store = Record<string, ConversationEntry>; // key = chatId (string)

function load(): Store {
  if (!existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf-8')) as Store;
  } catch {
    return {};
  }
}

function save(store: Store): void {
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

export function getConversation(chatId: number): ConversationEntry | null {
  const store = load();
  return store[String(chatId)] ?? null;
}

export function upsertConversation(entry: ConversationEntry): void {
  const store = load();
  store[String(entry.chatId)] = entry;
  save(store);
}

export function getAllConversations(): ConversationEntry[] {
  const store = load();
  return Object.values(store);
}

export function updateLastSeen(chatId: number, lastSeenCommentId: string): void {
  const store = load();
  const entry = store[String(chatId)];
  if (entry) {
    entry.lastSeenCommentId = lastSeenCommentId;
    entry.updatedAt = new Date().toISOString();
    save(store);
  }
}

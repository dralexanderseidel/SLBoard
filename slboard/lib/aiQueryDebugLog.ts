/**
 * Debug-Logging für KI-Dashboard-Anfragen (Chunks + Prompts).
 * Aktivieren: AI_DEBUG_LOG=1 in .env.local
 * Logdatei: logs/ai-query-debug.log (wird nicht committet)
 * Später: diese Datei und Aufrufe in app/api/ai/query/route.ts entfernen.
 */
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export function isAiQueryDebugEnabled(): boolean {
  const v = process.env.AI_DEBUG_LOG?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function isAiQueryDebugEnabledEffective(perSchoolEnabled: boolean | null | undefined): boolean {
  return isAiQueryDebugEnabled() || Boolean(perSchoolEnabled);
}

export type AiQueryDebugDocEntry = {
  documentId: string;
  title: string;
  chunkParams: { chunkChars: number; overlapChars: number; maxChunks: number };
  selectedChunks: string[];
  builtSnippetLength: number;
};

export type AiQueryDebugPayload = {
  timestamp: string;
  question: string;
  schoolNumber: string | null | undefined;
  keywords: string[];
  documentSelection: 'explicit_ids' | 'suggested';
  explicitDocumentIds: string[] | undefined;
  documents: AiQueryDebugDocEntry[];
  promptTemplateVersion?: number;
  systemPrompt: string;
  userPrompt: string;
};

export async function appendAiQueryDebugLog(
  payload: AiQueryDebugPayload,
  perSchoolEnabled?: boolean
): Promise<void> {
  if (!isAiQueryDebugEnabledEffective(perSchoolEnabled)) return;
  try {
    const dir = path.join(process.cwd(), 'logs');
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, 'ai-query-debug.log');
    const header = `\n${'='.repeat(80)}\n${payload.timestamp}\n${'='.repeat(80)}\n`;
    const body = `${JSON.stringify(payload, null, 2)}\n`;
    await appendFile(file, header + body, 'utf8');
  } catch (err) {
    console.error('[AI_DEBUG_LOG] Schreiben fehlgeschlagen:', err);
  }
}

export async function appendAiDebugEvent(
  event: string,
  payload: Record<string, unknown>,
  perSchoolEnabled?: boolean
): Promise<void> {
  if (!isAiQueryDebugEnabledEffective(perSchoolEnabled)) return;
  try {
    const dir = path.join(process.cwd(), 'logs');
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, 'ai-query-debug.log');
    const ts = new Date().toISOString();
    const header = `\n${'='.repeat(80)}\n${ts} :: ${event}\n${'='.repeat(80)}\n`;
    const body = `${JSON.stringify({ timestamp: ts, event, ...payload }, null, 2)}\n`;
    await appendFile(file, header + body, 'utf8');
  } catch (err) {
    console.error('[AI_DEBUG_LOG] Schreiben fehlgeschlagen:', err);
  }
}

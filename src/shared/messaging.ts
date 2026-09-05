import type { Reply, Request } from './types';
export async function request<T>(message: Request): Promise<T> {
  const reply = await chrome.runtime.sendMessage<Request, Reply<T>>(message);
  if (!reply) throw new Error('Extension unavailable. Reload this YouTube tab.');
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
}

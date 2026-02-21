/**
 * Thread ID validation for read-before-write enforcement.
 *
 * assistant-ui uses "DEFAULT_THREAD_ID" (from ExternalStoreThreadListRuntimeCore)
 * as a placeholder before a thread is persisted. The real UUID is set when:
 * - User sends first message -> adapter.initialize() POSTs to /api/threads -> returns remoteId
 * - AssistantChatTransport uses: id = (await mainItem.initialize())?.remoteId ?? options.id
 *
 * Until then, body.id can be "DEFAULT_THREAD_ID", which is not a valid UUID and will fail
 * DB inserts (thread_id references chat_threads.id). We skip recording/assert when invalid.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidThreadIdForDb(threadId: string | null | undefined): threadId is string {
  return !!threadId && UUID_REGEX.test(threadId);
}

// utils/qa.js
/**
 * Convert a flat message list into Q&A pairs.
 * Pairs each user message with the NEXT assistant message.
 * If the assistant reply is missing, returns answer: null (pending).
 */
export function toQAPairs(messages = []) {
  const pairs = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m?.role !== "user") continue;

    // find the very next assistant message
    const next = messages[i + 1];
    if (next && next.role === "assistant") {
      pairs.push({
        question: m.content ?? "",
        questionAt: m.createdAt ?? null,
        answer: next.content ?? "",
        answerAt: next.createdAt ?? null,
      });
      i++; // skip assistant we just paired
    } else {
      // unanswered question (e.g., still streaming/pending)
      pairs.push({
        question: m.content ?? "",
        questionAt: m.createdAt ?? null,
        answer: null,
        answerAt: null,
      });
    }
  }
  return pairs;
}

import { openai } from "../lib/openai.js";
import { ChatSession } from "../models/chatSession.model.js";
import { getClientContext } from "../utils/aiContext.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getCachedClientContext } from "../utils/contextCache.js";
import { toQAPairs } from "../utils/qa.js";


const MAX_TURNS = 15; // keep cost predictable
const MODEL = "gpt-4o-mini"; // good balance

export const startSession = asyncHandler(async (req, res) => {
  const agentId = req.user._id;
  const { clientId, title } = req.body || {};

  const session = await ChatSession.create({
    agentId,
    clientId: clientId || null,
    title: title || "",
    messages: [],
  });

  return res.status(201).json(new ApiResponse(201, session, "Chat session started"));
});

export const listSessions = asyncHandler(async (req, res) => {
  const agentId = req.user._id;
  const sessions = await ChatSession.find({ agentId })
    .populate("clientId", "clientName")
    .sort({ updatedAt: -1 })
    .select("title clientId updatedAt createdAt")
    .lean();

  // make a preview title if empty
  const data = sessions.map(s => ({
    ...s,
    displayTitle: s.title || (s?.clientId?.clientName ? `${s.clientId.clientName} Details` : "New Query"),
  }));
  return res.status(200).json(new ApiResponse(200, data, "Sessions fetched"));
});

export const getSession = asyncHandler(async (req, res) => {
  const agentId = req.user._id;
  const { sessionId } = req.params;
  const { format } = req.query; // ⬅️ read ?format=qa

  const session = await ChatSession.findOne({ _id: sessionId, agentId })
    .populate("clientId", "clientName")
    .lean();
  console.log("🚀 ~ session:", session)

  if (!session) throw new ApiError(404, "Session not found");

  if (format === "qa") {
    const qa = toQAPairs(session.messages || []);
    console.log("🚀 ~ qa:", qa)

    // Return a compact payload optimized for UI render
    const payload = {
      _id: session._id,
      title: session.title,
      clientId: session.clientId, // { _id, clientName } because of populate
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      qa, // ← list of { question, questionAt, answer, answerAt }
    };

    return res
      .status(200)
      .json(new ApiResponse(200, payload, "Session fetched (Q&A)"));
  }

  // default: return the full session with raw messages
  return res.status(200).json(new ApiResponse(200, session, "Session fetched"));
});

export const deleteSession = asyncHandler(async (req, res) => {
  const agentId = req.user._id;
  const { sessionId } = req.params;

  const deleted = await ChatSession.findOneAndDelete({ _id: sessionId, agentId });
  if (!deleted) throw new ApiError(404, "Session not found");

  return res.status(200).json(new ApiResponse(200, { sessionId }, "Session deleted"));
});

export const sendMessage = asyncHandler(async (req, res) => {
  const agentId = req.user._id;
  const { sessionId, message, clientId: clientIdOverride } = req.body || {};
  if (!sessionId || !message) throw new ApiError(400, "sessionId and message are required");

  // load session (ensure ownership)
  const session = await ChatSession.findOne({ _id: sessionId, agentId });
  if (!session) throw new ApiError(404, "Session not found");

  // allow switching/attaching a client mid-thread
  if (clientIdOverride) session.clientId = clientIdOverride;

  // append user message
  session.messages.push({ role: "user", content: message });

  // build context (structured RAG)
  const contextText = await getCachedClientContext(
  agentId,
  session.clientId,
  () => getClientContext(agentId, session.clientId)
);
  console.log("🚀 ~ contextText:", contextText)

  // slice last N turns for cost control
  const history = session.messages.slice(-MAX_TURNS);
  

  const systemPrompt = `
You are the TSG AI Assistant for real estate agents.
Rules:
- If a client is linked, prioritize facts from the provided TSG CONTEXT.
- If info is missing or ambiguous, ask ONE short clarifying question.
- Be concise and action-oriented; avoid placeholders when you can compute values.
- If the user asks for an email/message, return a clear subject and body.

Output preferences:
- Use bullet points for summaries.
- Dates in dd/mm/yyyy, currency as £123,456.
`.trim();


  // OpenAI call
  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      ...(contextText ? [{ role: "system", content: contextText }] : []),
      ...history.map(m => ({ role: m.role, content: m.content })),
    ],
    // max_tokens: Number(process.env.OPENAI_MAX_TOKENS || 800),
    // temperature: Number(process.env.OPENAI_TEMPERATURE || 0.2),
  });
  console.log("🚀 ~ completion:", completion)

  const reply = completion.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";

  // append assistant message & save
  session.messages.push({ role: "assistant", content: reply });
  await session.save();

  return res.status(200).json(new ApiResponse(200, { reply, sessionId: session._id }, "Message answered"));
});

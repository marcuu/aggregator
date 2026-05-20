import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/prompts/system";
import { buildUserContext } from "@/lib/prompts/context";

/**
 * Streaming chat endpoint. Orchestrated through the Vercel AI Gateway — the
 * model id is a gateway-routed string, so no provider key is needed in the
 * app code. On Vercel the gateway authenticates via OIDC; locally an
 * AI_GATEWAY_API_KEY env var is required.
 *
 * The system prompt is rebuilt per request from live Postgres data, so the
 * model always sees the user's current scores, goals, and surplus — never
 * has to ask basic facts.
 */
export const maxDuration = 30;

const MODEL_ID = "anthropic/claude-sonnet-4.6";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorised", { status: 401 });
  }

  let context;
  try {
    context = await buildUserContext(user, supabase);
  } catch {
    return new Response("Onboarding required", { status: 412 });
  }

  const result = streamText({
    model: MODEL_ID,
    system: buildSystemPrompt(context),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}

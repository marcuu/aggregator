import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient, getRequestUserId } from "@/lib/supabase/server";

const Body = z.object({ promptId: z.string().min(1).max(64) });

/**
 * Records a prompt-card dismissal. The id is a deterministic content hash,
 * so once stored the same card will not be regenerated until the underlying
 * data changes meaningfully.
 */
export async function POST(req: Request) {
  const userId = await getRequestUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("dismissed_prompts")
    .upsert(
      { user_id: userId, prompt_id: parsed.data.promptId },
      { onConflict: "user_id,prompt_id", ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

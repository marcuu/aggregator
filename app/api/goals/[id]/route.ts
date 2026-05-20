import { z } from "zod";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const PatchBody = z.object({
  target_amount: z.number().int().positive().optional(),
  rough_target_date: z.string().date().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const { id } = await params;

  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const patch = parsed.data;
  if (patch.target_amount === undefined && patch.rough_target_date === undefined) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("goals")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: "update failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

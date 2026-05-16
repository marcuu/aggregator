import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";
import { syncUser } from "@/lib/truelayer/sync";
import { verifyWebhookSignature } from "@/lib/truelayer/webhook";
import { webhookEventSchema } from "@/lib/validators/truelayer";

const SIGNATURE_HEADER = "x-tl-signature";

/**
 * TrueLayer webhook receiver. Verifies the HMAC signature, and on a
 * data-update event resyncs the owning user. Always responds quickly so
 * TrueLayer does not retry; processing errors are logged, not surfaced.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const signatureValid = verifyWebhookSignature(
    rawBody,
    request.headers.get(SIGNATURE_HEADER),
    process.env.TRUELAYER_WEBHOOK_SECRET,
  );

  if (!signatureValid) {
    console.warn("Rejected TrueLayer webhook: invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = webhookEventSchema.parse(JSON.parse(rawBody));
  } catch (error) {
    console.warn("Rejected TrueLayer webhook: unparseable body", error);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Only data-update events warrant a resync; acknowledge everything else.
  const isDataUpdate = event.type.startsWith("data");
  if (isDataUpdate && event.connection_id) {
    try {
      const supabase = createServiceClient();
      const { data: connection } = await supabase
        .from("ob_connections")
        .select("user_id")
        .eq("provider_connection_id", event.connection_id)
        .maybeSingle();

      if (connection) {
        await syncUser(connection.user_id, supabase);
      } else {
        console.warn(
          `Webhook connection_id ${event.connection_id} matched no connection`,
        );
      }
    } catch (error) {
      // Don't fail the webhook — TrueLayer would retry needlessly.
      console.error("Webhook-triggered sync failed:", error);
    }
  }

  return NextResponse.json({ received: true });
}

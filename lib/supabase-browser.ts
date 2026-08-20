import { createClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

let client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  client = createClient<Database>(url, anon);

  // Browsers throttle timers in background/idle tabs, so the client's
  // scheduled token refresh can be delayed past the token's expiry.
  // When the tab comes back into focus, force a refresh check right away
  // instead of letting the next query fail with an expired-session error.
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        client?.auth.startAutoRefresh();
      } else {
        client?.auth.stopAutoRefresh();
      }
    });
  }

  return client;
}

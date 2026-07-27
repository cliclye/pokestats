/**
 * Push local data/store.json into Supabase.
 * Usage: npx tsx scripts/push-supabase.ts
 */
import { promises as fs } from "fs";
import path from "path";

async function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  try {
    const raw = await fs.readFile(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

async function main() {
  await loadEnvLocal();
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.JOBS_SECRET) ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and JOBS_SECRET (or SERVICE_ROLE_KEY) in .env.local",
    );
  }

  const storePath = path.join(process.cwd(), "data", "store.json");
  const raw = await fs.readFile(storePath, "utf8").catch(() => null);
  if (!raw) {
    throw new Error("data/store.json missing — run npm run seed && import/sync first");
  }

  const store = JSON.parse(raw);
  const { pushStoreToSupabase } = await import("../src/lib/store");
  console.log("Pushing store to Supabase…", {
    locations: store.locations?.length,
    cards: store.cards?.length,
    signals: store.webSignals?.length,
  });
  await pushStoreToSupabase(store);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

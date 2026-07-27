import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";
import { fetchAllSets } from "@/lib/pokemontcg";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readStore();
  if (store.sets.length > 0) {
    return NextResponse.json({ sets: store.sets, meta: store.meta });
  }

  try {
    const sets = await fetchAllSets();
    return NextResponse.json({ sets, meta: store.meta, live: true });
  } catch (err) {
    return NextResponse.json(
      { sets: [], meta: store.meta, error: String(err) },
      { status: 200 },
    );
  }
}

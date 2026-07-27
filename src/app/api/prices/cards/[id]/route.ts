import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const store = await readStore();
  const card = store.cards.find((c) => c.id === id);
  if (!card) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ card, meta: store.meta });
}

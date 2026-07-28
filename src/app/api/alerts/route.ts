import { NextResponse } from "next/server";
import { SET_CATALOG } from "@/lib/stock/product-taxonomy";
import {
  normalizeUsPhone,
  subscribeStockAlert,
  unsubscribeStockAlert,
} from "@/lib/alerts";
import { smsConfigured } from "@/lib/sms";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (token) {
    try {
      const ok = await unsubscribeStockAlert(token);
      const html = `<!doctype html><html><body style="font-family:system-ui;background:#07120e;color:#c8d9d0;padding:2rem">
        <h1>${ok ? "Alerts stopped" : "Link invalid"}</h1>
        <p>${ok ? "You will no longer get PokeStats stock texts." : "This unsubscribe link is not valid."}</p>
        <p><a href="/web-stock" style="color:#5cffb0">Back to Web stock</a></p>
      </body></html>`;
      return new NextResponse(html, {
        status: ok ? 200 : 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "unsubscribe_failed" },
        { status: 500 },
      );
    }
  }

  const store = await readStore();
  const setCodes = new Set(store.products.map((p) => p.setCode));
  const sets = SET_CATALOG.filter((s) => setCodes.has(s.code)).map((s) => ({
    code: s.code,
    label: s.label,
  }));

  return NextResponse.json({
    sets,
    products: store.products.map((p) => ({
      id: p.id,
      name: p.name,
      setCode: p.setCode,
    })),
    smsReady: smsConfigured(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      phone?: string;
      setCodes?: string[];
      productIds?: string[];
    };

    const phone = normalizeUsPhone(body.phone || "");
    if (!phone) {
      return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
    }

    const setCodes = Array.from(
      new Set((body.setCodes || []).map((s) => String(s).trim()).filter(Boolean)),
    ).slice(0, 12);
    const productIds = Array.from(
      new Set((body.productIds || []).map((s) => String(s).trim()).filter(Boolean)),
    ).slice(0, 20);

    if (!setCodes.length && !productIds.length) {
      return NextResponse.json({ error: "need_set_or_product" }, { status: 400 });
    }

    const result = await subscribeStockAlert({ phone, setCodes, productIds });
    return NextResponse.json({
      ok: true,
      phone: result.phone,
      unsubscribeToken: result.unsubscribeToken,
      smsReady: smsConfigured(),
      message: smsConfigured()
        ? "Reminder saved. We’ll text you when those sets hit MSRP stock."
        : "Reminder saved. SMS delivery needs Twilio env vars on the server.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "subscribe_failed";
    const status =
      /invalid_phone|need_set|too_many/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }
  try {
    const ok = await unsubscribeStockAlert(token);
    return NextResponse.json({ ok });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unsubscribe_failed" },
      { status: 500 },
    );
  }
}

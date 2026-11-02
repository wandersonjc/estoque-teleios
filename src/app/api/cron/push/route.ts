import { timingSafeEqual } from "node:crypto";

import { processarFilaPush } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function segredoValido(request: Request, segredo: string) {
  const recebido = request.headers.get("authorization") ?? "";
  const esperado = `Bearer ${segredo}`;
  const recebidoBuffer = Buffer.from(recebido);
  const esperadoBuffer = Buffer.from(esperado);
  return (
    recebidoBuffer.length === esperadoBuffer.length &&
    timingSafeEqual(recebidoBuffer, esperadoBuffer)
  );
}

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return Response.json(
      { erro: "CRON_SECRET não está configurado." },
      { status: 503 }
    );
  }
  if (!segredoValido(request, segredo)) {
    return Response.json({ erro: "Não autorizado." }, { status: 401 });
  }

  if (
    !process.env.VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY ||
    !process.env.VAPID_SUBJECT
  ) {
    return Response.json(
      { erro: "As chaves e o contato VAPID não estão configurados." },
      { status: 503 }
    );
  }

  const resumo = await processarFilaPush();
  return Response.json(resumo);
}

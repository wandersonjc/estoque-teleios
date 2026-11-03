import webpush from "web-push";

import { Prisma, StatusEntregaPush } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

const TAMANHO_LOTE = 8;
const MAX_TENTATIVAS = 8;
const LEASE_MS = 5 * 60 * 1000;

const ORIGENS_PUSH_PERMITIDAS = [
  "fcm.googleapis.com",
  "web.push.apple.com",
  "push.services.mozilla.com",
  "notify.windows.com",
];

export type ResumoProcessamentoPush = {
  processadas: number;
  enviadas: number;
  retentativas: number;
  falhas: number;
  assinaturasExpiradas: number;
};

export function endpointPushPermitido(valor: string) {
  try {
    const url = new URL(valor);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      ORIGENS_PUSH_PERMITIDAS.some(
        (dominio) =>
          url.hostname === dominio || url.hostname.endsWith(`.${dominio}`)
      )
    );
  } catch {
    return false;
  }
}

function statusDoErro(erro: unknown) {
  if (typeof erro !== "object" || erro === null || !("statusCode" in erro)) {
    return undefined;
  }
  const status = erro.statusCode;
  return typeof status === "number" ? status : undefined;
}

function mensagemDoErro(erro: unknown) {
  const status = statusDoErro(erro);
  if (status !== undefined) return `Serviço push respondeu HTTP ${status}.`;
  return "Falha desconhecida ao enviar push.";
}

export async function processarFilaPush(
  tamanhoLote = TAMANHO_LOTE
): Promise<ResumoProcessamentoPush> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT são obrigatórios para enviar push."
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const agora = new Date();
  const ids = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    WITH candidatos AS (
      SELECT id
      FROM entrega_push
      WHERE (
        status = 'PENDENTE'
        AND proxima_tentativa_em <= ${agora}
      ) OR (
        status = 'PROCESSANDO'
        AND bloqueio_ate <= ${agora}
      )
      ORDER BY criado_em, id
      FOR UPDATE SKIP LOCKED
      LIMIT ${Math.max(1, Math.min(TAMANHO_LOTE, Math.floor(tamanhoLote)))}
    )
    UPDATE entrega_push AS entrega
    SET status = 'PROCESSANDO',
        bloqueio_ate = ${new Date(agora.getTime() + LEASE_MS)},
        tentativas = entrega.tentativas + 1,
        atualizado_em = ${agora}
    FROM candidatos
    WHERE entrega.id = candidatos.id
    RETURNING entrega.id
  `);

  const resumo: ResumoProcessamentoPush = {
    processadas: ids.length,
    enviadas: 0,
    retentativas: 0,
    falhas: 0,
    assinaturasExpiradas: 0,
  };

  for (const { id } of ids) {
    const entrega = await prisma.entregaPush.findUnique({
      where: { id },
      include: {
        notificacao: {
          select: {
            id: true,
            transferenciaId: true,
            mensagem: true,
          },
        },
        assinatura: {
          select: {
            id: true,
            endpoint: true,
            chaveP256dh: true,
            chaveAuth: true,
          },
        },
      },
    });
    if (!entrega) continue;

    if (!endpointPushPermitido(entrega.assinatura.endpoint)) {
      await prisma.assinaturaPush.deleteMany({
        where: { id: entrega.assinatura.id },
      });
      resumo.assinaturasExpiradas += 1;
      continue;
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: entrega.assinatura.endpoint,
          keys: {
            p256dh: entrega.assinatura.chaveP256dh,
            auth: entrega.assinatura.chaveAuth,
          },
        },
        JSON.stringify({
          title: "Atria",
          body: entrega.notificacao.mensagem,
          url: `/transferencias/${entrega.notificacao.transferenciaId}`,
          tag: `notificacao-${entrega.notificacao.id}`,
        }),
        { TTL: 3600, urgency: "high", timeout: 5000 }
      );
      await prisma.entregaPush.update({
        where: { id },
        data: {
          status: StatusEntregaPush.ENVIADA,
          enviadaEm: new Date(),
          bloqueioAte: null,
          ultimoErro: null,
        },
      });
      resumo.enviadas += 1;
    } catch (erro) {
      const status = statusDoErro(erro);
      if (status === 404 || status === 410) {
        await prisma.assinaturaPush.deleteMany({
          where: { id: entrega.assinatura.id },
        });
        resumo.assinaturasExpiradas += 1;
        continue;
      }

      const final = entrega.tentativas >= MAX_TENTATIVAS;
      console.warn(
        `Entrega push ${id} falhou (HTTP ${status ?? "sem status"}); ` +
          `${final ? "limite de tentativas atingido" : "será retentada"}.`
      );
      const minutosAteNovaTentativa = Math.min(
        360,
        2 ** Math.min(entrega.tentativas - 1, 8)
      );
      await prisma.entregaPush.update({
        where: { id },
        data: {
          status: final
            ? StatusEntregaPush.FALHOU
            : StatusEntregaPush.PENDENTE,
          proximaTentativaEm: new Date(
            Date.now() + minutosAteNovaTentativa * 60_000
          ),
          bloqueioAte: null,
          ultimoErro: mensagemDoErro(erro),
        },
      });
      if (final) {
        resumo.falhas += 1;
      } else {
        resumo.retentativas += 1;
      }
    }
  }

  if (resumo.processadas > 0) {
    console.info("Resumo do processamento push:", resumo);
  }

  return resumo;
}

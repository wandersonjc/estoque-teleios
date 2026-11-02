import { obterSessao } from "@/lib/sessao";
import prisma from "@/lib/prisma";
import { endpointPushPermitido } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CABECALHOS_PRIVADOS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};

type AssinaturaRecebida = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function respostaJson(dados: unknown, status = 200) {
  return Response.json(dados, { status, headers: CABECALHOS_PRIVADOS });
}

async function usuarioAutorizado() {
  const sessao = await obterSessao();
  if (!sessao) {
    return { resposta: respostaJson({ erro: "Não autenticado." }, 401) };
  }
  if (!sessao.codigosPermissao.includes("transferencias.pedido.consultar")) {
    return {
      resposta: respostaJson(
        { erro: "Sem permissão para receber notificações de transferências." },
        403
      ),
    };
  }
  return { usuarioId: sessao.usuario.id };
}

function origemDaRequisicaoPermitida(request: Request) {
  const siteDaRequisicao = request.headers.get("sec-fetch-site");
  if (siteDaRequisicao === "same-origin") return true;
  if (siteDaRequisicao && siteDaRequisicao !== "none") return false;

  const origem = request.headers.get("origin");
  if (!origem) {
    return false;
  }

  try {
    const origemRecebida = new URL(origem);
    if (
      !["http:", "https:"].includes(origemRecebida.protocol) ||
      origemRecebida.origin !== origem
    ) {
      return false;
    }

    const urlRequisicao = new URL(request.url);
    const hosts = [
      request.headers.get("host"),
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim(),
      urlRequisicao.host,
    ].filter((host): host is string => Boolean(host));
    const protocolos = [
      urlRequisicao.protocol,
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim(),
    ].filter((protocolo): protocolo is string =>
      protocolo === "http" || protocolo === "https" ||
      protocolo === "http:" || protocolo === "https:"
    ).map((protocolo) =>
      protocolo.endsWith(":") ? protocolo : `${protocolo}:`
    );

    return hosts.some((host) =>
      protocolos.some((protocolo) => {
        try {
          return new URL(`${protocolo}//${host}`).origin === origemRecebida.origin;
        } catch {
          return false;
        }
      })
    );
  } catch {
    return false;
  }
}

async function lerJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function assinaturaValida(valor: unknown): valor is AssinaturaRecebida {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    return false;
  }
  const assinatura = valor as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  return (
    typeof assinatura.endpoint === "string" &&
    assinatura.endpoint.length <= 2048 &&
    endpointPushPermitido(assinatura.endpoint) &&
    typeof assinatura.keys?.p256dh === "string" &&
    assinatura.keys.p256dh.length > 0 &&
    assinatura.keys.p256dh.length <= 255 &&
    typeof assinatura.keys.auth === "string" &&
    assinatura.keys.auth.length > 0 &&
    assinatura.keys.auth.length <= 255
  );
}

export async function GET() {
  const acesso = await usuarioAutorizado();
  if ("resposta" in acesso) return acesso.resposta;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const assinaturas = await prisma.assinaturaPush.count({
    where: { usuarioId: acesso.usuarioId },
  });
  return respostaJson({
    disponivel: Boolean(publicKey),
    publicKey: publicKey ?? null,
    assinaturas,
  });
}

export async function POST(request: Request) {
  if (!origemDaRequisicaoPermitida(request)) {
    return respostaJson({ erro: "Origem da solicitação não permitida." }, 403);
  }
  const acesso = await usuarioAutorizado();
  if ("resposta" in acesso) return acesso.resposta;
  if (!process.env.VAPID_PUBLIC_KEY) {
    return respostaJson(
      { erro: "As notificações push ainda não foram configuradas no servidor." },
      503
    );
  }

  const corpo = await lerJson(request);
  if (!assinaturaValida(corpo)) {
    return respostaJson({ erro: "Assinatura push inválida ou não suportada." }, 400);
  }

  const assinatura = corpo;
  await prisma.$transaction(async (tx) => {
    const existente = await tx.assinaturaPush.findUnique({
      where: { endpoint: assinatura.endpoint },
      select: { id: true, usuarioId: true },
    });
    if (existente && existente.usuarioId !== acesso.usuarioId) {
      await tx.assinaturaPush.delete({ where: { id: existente.id } });
      await tx.assinaturaPush.create({
        data: {
          usuarioId: acesso.usuarioId,
          endpoint: assinatura.endpoint,
          chaveP256dh: assinatura.keys.p256dh,
          chaveAuth: assinatura.keys.auth,
        },
      });
      return;
    }

    await tx.assinaturaPush.upsert({
      where: { endpoint: assinatura.endpoint },
      create: {
        usuarioId: acesso.usuarioId,
        endpoint: assinatura.endpoint,
        chaveP256dh: assinatura.keys.p256dh,
        chaveAuth: assinatura.keys.auth,
      },
      update: {
        chaveP256dh: assinatura.keys.p256dh,
        chaveAuth: assinatura.keys.auth,
      },
    });
  });

  return new Response(null, { status: 204, headers: CABECALHOS_PRIVADOS });
}

export async function DELETE(request: Request) {
  if (!origemDaRequisicaoPermitida(request)) {
    return respostaJson({ erro: "Origem da solicitação não permitida." }, 403);
  }
  const acesso = await usuarioAutorizado();
  if ("resposta" in acesso) return acesso.resposta;

  const corpo = await lerJson(request);
  if (
    typeof corpo !== "object" ||
    corpo === null ||
    Array.isArray(corpo) ||
    typeof (corpo as { endpoint?: unknown }).endpoint !== "string" ||
    !endpointPushPermitido((corpo as { endpoint: string }).endpoint)
  ) {
    return respostaJson({ erro: "Endpoint da assinatura inválido." }, 400);
  }

  await prisma.assinaturaPush.deleteMany({
    where: {
      usuarioId: acesso.usuarioId,
      endpoint: (corpo as { endpoint: string }).endpoint,
    },
  });
  return new Response(null, { status: 204, headers: CABECALHOS_PRIVADOS });
}

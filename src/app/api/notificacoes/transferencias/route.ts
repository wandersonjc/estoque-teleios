import prisma from "@/lib/prisma";
import { obterSessao } from "@/lib/sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CABECALHOS_PRIVADOS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};

function respostaJson(dados: unknown, status = 200) {
  return Response.json(dados, { status, headers: CABECALHOS_PRIVADOS });
}

async function usuarioAutorizado() {
  const sessao = await obterSessao();
  if (!sessao) return { resposta: respostaJson({ erro: "Não autenticado." }, 401) };
  if (!sessao.codigosPermissao.includes("transferencias.pedido.consultar")) {
    return {
      resposta: respostaJson({ erro: "Sem permissão para consultar transferências." }, 403),
    };
  }
  return { usuarioId: sessao.usuario.id };
}

export async function GET() {
  const acesso = await usuarioAutorizado();
  if ("resposta" in acesso) return acesso.resposta;

  const whereNaoLidas = { usuarioId: acesso.usuarioId, lidaEm: null };
  const [notificacoes, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where: { usuarioId: acesso.usuarioId },
      orderBy: { criadoEm: "desc" },
      take: 10,
      select: {
        id: true,
        transferenciaId: true,
        tipo: true,
        mensagem: true,
        criadoEm: true,
        lidaEm: true,
      },
    }),
    prisma.notificacao.count({ where: whereNaoLidas }),
  ]);

  return respostaJson({ notificacoes, naoLidas });
}

export async function PATCH(request: Request) {
  const acesso = await usuarioAutorizado();
  if ("resposta" in acesso) return acesso.resposta;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return respostaJson({ erro: "Corpo da solicitação inválido." }, 400);
  }

  if (
    typeof corpo !== "object" ||
    corpo === null ||
    Array.isArray(corpo)
  ) {
    return respostaJson({ erro: "Corpo da solicitação inválido." }, 400);
  }

  const dados = corpo as { id?: unknown; todas?: unknown };
  const lidaEm = new Date();
  if (dados.todas === true && dados.id === undefined) {
    await prisma.notificacao.updateMany({
      where: { usuarioId: acesso.usuarioId, lidaEm: null },
      data: { lidaEm },
    });
    return new Response(null, { status: 204, headers: CABECALHOS_PRIVADOS });
  }

  if (
    typeof dados.id !== "number" ||
    !Number.isSafeInteger(dados.id) ||
    dados.id <= 0 ||
    dados.todas !== undefined
  ) {
    return respostaJson({ erro: "Identificador de notificação inválido." }, 400);
  }

  await prisma.notificacao.updateMany({
    where: {
      id: dados.id,
      usuarioId: acesso.usuarioId,
      lidaEm: null,
    },
    data: { lidaEm },
  });
  return new Response(null, { status: 204, headers: CABECALHOS_PRIVADOS });
}

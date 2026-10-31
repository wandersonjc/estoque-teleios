import prisma from "@/lib/prisma";
import { obterSessao } from "@/lib/sessao";
import { buscarImagem } from "@/lib/armazenamento-imagens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CABECALHOS_PRIVADOS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tipo: string; id: string }> }
) {
  const sessao = await obterSessao();
  if (!sessao) return new Response(null, { status: 401, headers: CABECALHOS_PRIVADOS });

  const { tipo, id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response(null, { status: 404, headers: CABECALHOS_PRIVADOS });
  }

  let imagemChave: string | null | undefined;

  if (tipo === "produtos") {
    if (!sessao.codigosPermissao.includes("produtos.produto.consultar")) {
      return new Response(null, { status: 403, headers: CABECALHOS_PRIVADOS });
    }
    imagemChave = (
      await prisma.produto.findUnique({
        where: { id },
        select: { imagemChave: true },
      })
    )?.imagemChave;
  } else if (tipo === "fornecedores") {
    if (!sessao.codigosPermissao.includes("fornecedores.fornecedor.consultar")) {
      return new Response(null, { status: 403, headers: CABECALHOS_PRIVADOS });
    }
    imagemChave = (
      await prisma.fornecedor.findUnique({
        where: { id },
        select: { imagemChave: true },
      })
    )?.imagemChave;
  } else if (tipo === "usuarios") {
    if (!sessao.codigosPermissao.includes("usuarios.usuario.consultar")) {
      return new Response(null, { status: 403, headers: CABECALHOS_PRIVADOS });
    }
    imagemChave = (
      await prisma.usuario.findUnique({
        where: { id },
        select: { imagemChave: true },
      })
    )?.imagemChave;
  } else {
    return new Response(null, { status: 404, headers: CABECALHOS_PRIVADOS });
  }

  if (!imagemChave) {
    return new Response(null, { status: 404, headers: CABECALHOS_PRIVADOS });
  }

  try {
    const objeto = await buscarImagem(imagemChave);
    if (!objeto.Body) {
      return new Response(null, { status: 404, headers: CABECALHOS_PRIVADOS });
    }

    const tipoConteudo = objeto.ContentType;
    if (!tipoConteudo || !["image/jpeg", "image/png", "image/webp"].includes(tipoConteudo)) {
      return new Response(null, { status: 404, headers: CABECALHOS_PRIVADOS });
    }

    const conteudo = await objeto.Body.transformToByteArray();
    const corpo = new ArrayBuffer(conteudo.byteLength);
    new Uint8Array(corpo).set(conteudo);
    return new Response(corpo, {
      headers: {
        ...CABECALHOS_PRIVADOS,
        "Content-Type": tipoConteudo,
        "Content-Length": String(conteudo.byteLength),
      },
    });
  } catch (erro) {
    console.error("Falha ao carregar imagem privada do R2:", erro);
    return new Response(null, { status: 502, headers: CABECALHOS_PRIVADOS });
  }
}
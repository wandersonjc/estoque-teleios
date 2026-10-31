// ============================================================
// Módulo 1 - Módulos e Permissões: página (Server Component)
// A matriz é montada a partir do CATÁLOGO gravado no banco
// (tabela "permissao"), nunca de uma lista fixa aqui.
// Acesso liberado só para quem tem "permissoes.permissao.consultar";
// alterar exige "permissoes.permissao.conceder" (checado também na
// ação do servidor).
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";

import MatrizPermissoes from "./MatrizPermissoes";
import { type ModuloDaMatriz, type UsuarioParaBusca } from "./tipos";

// A tela precisa mostrar o banco no estado atual, sem cache
export const dynamic = "force-dynamic";

// Um parâmetro pode chegar repetido na URL (vira vetor); usamos o primeiro
function textoDoParametro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

export default async function PermissoesPage({
  searchParams,
}: PageProps<"/permissoes">) {
  // Só entra quem pode consultar permissões
  const atual = await exigirPermissao("permissoes.permissao.consultar");
  const podeConceder = atual.permissoes.has("permissoes.permissao.conceder");

  const parametros = await searchParams;
  const idPedido = Number(textoDoParametro(parametros.usuario));
  const idPedidoValido = Number.isInteger(idPedido) && idPedido > 0 ? idPedido : 0;

  // Essas leituras são independentes e podem compartilhar a latência do banco.
  const [usuarios, catalogo, concessoesSelecionadas] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, email: true, ativo: true },
    }),
    prisma.permissao.findMany({
      orderBy: [{ ordem: "asc" }, { codigo: "asc" }],
      select: {
        codigo: true,
        modulo: true,
        funcionalidade: true,
        operacao: true,
        descricao: true,
      },
    }),
    prisma.permissaoUsuario.findMany({
      where: { usuarioId: idPedidoValido },
      select: { permissao: { select: { codigo: true } } },
    }),
  ]);

  const usuarioSelecionado: UsuarioParaBusca | null =
    usuarios.find((usuario) => usuario.id === idPedidoValido) ?? null;
  const codigosConcedidos = usuarioSelecionado
    ? concessoesSelecionadas.map((concessao) => concessao.permissao.codigo)
    : [];

  const modulos = montarMatriz(catalogo);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">
        Módulos e Permissões
      </h1>
      <p className="mt-1 text-sm text-zinc-600">
        Escolha um usuário e marque as permissões que ele deve ter. As
        permissões são individuais: não existem perfis nem grupos.
      </p>

      <MatrizPermissoes
        usuarios={usuarios}
        usuarioSelecionado={usuarioSelecionado}
        modulos={modulos}
        codigosConcedidos={codigosConcedidos}
        podeConceder={podeConceder}
      />
    </main>
  );
}

// ------------------------------------------------------------
// Agrupa as linhas do catálogo em módulos e funcionalidades,
// mantendo a ordem em que vieram do banco.
// ------------------------------------------------------------
type LinhaCatalogo = {
  codigo: string;
  modulo: string;
  funcionalidade: string;
  operacao: string;
  descricao: string;
};

function montarMatriz(linhas: LinhaCatalogo[]): ModuloDaMatriz[] {
  const modulos: ModuloDaMatriz[] = [];

  for (const linha of linhas) {
    let modulo = modulos.find((item) => item.nome === linha.modulo);
    if (!modulo) {
      modulo = { nome: linha.modulo, funcionalidades: [] };
      modulos.push(modulo);
    }

    let funcionalidade = modulo.funcionalidades.find(
      (item) => item.nome === linha.funcionalidade
    );
    if (!funcionalidade) {
      funcionalidade = { nome: linha.funcionalidade, operacoes: [] };
      modulo.funcionalidades.push(funcionalidade);
    }

    funcionalidade.operacoes.push({
      codigo: linha.codigo,
      operacao: linha.operacao,
      descricao: linha.descricao,
    });
  }

  return modulos;
}

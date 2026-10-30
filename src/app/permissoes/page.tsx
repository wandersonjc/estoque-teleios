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
import { sincronizarCatalogoDePermissoes } from "@/lib/permissoes";
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
  // Garante que permissões novas do catálogo já existam no banco
  // (nascem negadas: ninguém recebe nada aqui).
  await sincronizarCatalogoDePermissoes();

  // Só entra quem pode consultar permissões
  const atual = await exigirPermissao("permissoes.permissao.consultar");
  const podeConceder = atual.permissoes.has("permissoes.permissao.conceder");

  const parametros = await searchParams;
  const idPedido = Number(textoDoParametro(parametros.usuario));

  // Usuários para a busca do topo
  const usuarios: UsuarioParaBusca[] = await prisma.usuario.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, email: true, ativo: true },
  });

  // Usuário escolhido (se o id informado existir de verdade)
  const usuarioSelecionado =
    Number.isInteger(idPedido) && idPedido > 0
      ? await prisma.usuario.findUnique({
          where: { id: idPedido },
          select: { id: true, nome: true, email: true },
        })
      : null;

  // Códigos concedidos ao usuário escolhido
  const codigosConcedidos = usuarioSelecionado
    ? (
        await prisma.permissaoUsuario.findMany({
          where: { usuarioId: usuarioSelecionado.id },
          select: { permissao: { select: { codigo: true } } },
        })
      ).map((concessao) => concessao.permissao.codigo)
    : [];

  // Monta a matriz a partir do catálogo do banco:
  // módulo -> funcionalidade -> operação, na ordem definida.
  const catalogo = await prisma.permissao.findMany({
    orderBy: [{ ordem: "asc" }, { codigo: "asc" }],
    select: {
      codigo: true,
      modulo: true,
      funcionalidade: true,
      operacao: true,
      descricao: true,
    },
  });

  const modulos = montarMatriz(catalogo);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <h1 className="text-xl font-semibold text-zinc-900">
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

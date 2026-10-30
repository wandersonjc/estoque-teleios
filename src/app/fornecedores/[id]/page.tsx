// ============================================================
// Módulo 2 - Tela do fornecedor
// Dados cadastrais, vínculos com produtos (RN-09) e preços
// cotados (RN-10 e RN-11).
// ============================================================

import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

import BotaoAcao from "@/components/BotaoAcao";
import { formatarDecimalBr } from "@/app/produtos/tipos";

import AbasFornecedor from "../AbasFornecedor";
import FormularioFornecedor from "../FormularioFornecedor";
import FormularioPrecoCotado from "../FormularioPrecoCotado";
import FormularioVinculo from "../FormularioVinculo";
import ListaVinculos from "../ListaVinculos";
import {
  atualizarFornecedor,
  desativarFornecedor,
  reativarFornecedor,
} from "../actions";
import {
  formatarDataPreco,
  formatarMoeda,
  formatarMoedaOpcional,
  precosAtuais,
  ROTULO_ORIGEM_PRECO,
} from "../tipos";

export const dynamic = "force-dynamic";

export default async function PaginaEditarFornecedor({
  params,
  searchParams,
}: PageProps<"/fornecedores/[id]">) {
  const atual = await exigirPermissao("fornecedores.fornecedor.consultar");

  const { id } = await params;
  const avisos = await searchParams;
  const abaInicial = Array.isArray(avisos.aba) ? avisos.aba[0] : avisos.aba;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  const podeEditar = atual.permissoes.has("fornecedores.fornecedor.editar");
  const podeDesativar = atual.permissoes.has(
    "fornecedores.fornecedor.desativar"
  );
  const podeVincular = atual.permissoes.has("fornecedores.vinculo.gerenciar");
  const podeCotar = atual.permissoes.has("fornecedores.preco.cotar");

  const [fornecedor, vinculos, historico, produtosAtivos] = await Promise.all([
    prisma.fornecedor.findUnique({ where: { id: numero } }),
    prisma.produtoFornecedor.findMany({
      where: { fornecedorId: numero },
      include: {
        produto: { select: { id: true, nome: true, ativo: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.historicoPreco.findMany({
      where: { fornecedorId: numero },
      include: { produto: { select: { nome: true } } },
      orderBy: [{ data: "desc" }, { id: "desc" }],
    }),
    prisma.produto.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  if (!fornecedor) notFound();

  const idsVinculados = new Set(vinculos.map((item) => item.produtoId));
  const produtosParaVincular = produtosAtivos.filter(
    (produto) => !idsVinculados.has(produto.id)
  );
  const produtosParaPreco = vinculos.map((item) => ({
    id: item.produtoId,
    nome: item.produto.nome,
  }));

  const mapaPrecos = precosAtuais(historico);
  const retorno = `/fornecedores/${fornecedor.id}`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">
          {podeEditar ? "Editar fornecedor" : "Fornecedor"}
        </h1>
        <Link href="/fornecedores" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>

      {avisos.salvo === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Fornecedor salvo com sucesso.
        </p>
      )}
      {avisos.vinculo === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Vínculo salvo com sucesso.
        </p>
      )}
      {avisos.preco === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Preço cotado registrado.
        </p>
      )}

      {!fornecedor.ativo && (
        <p className="mt-4 rounded-lg bg-zinc-100 p-3 text-base text-zinc-700">
          Este fornecedor está inativo.
        </p>
      )}

      <AbasFornecedor
        abaInicial={abaInicial}
        geral={
          podeEditar ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <h2 className="text-base font-semibold text-zinc-900">
                Dados cadastrais
              </h2>
              <FormularioFornecedor
                acao={atualizarFornecedor}
                textoBotao="Salvar alterações"
                id={fornecedor.id}
                valoresIniciais={{
                  nome: fornecedor.nome,
                  contato: fornecedor.contato ?? "",
                  prazoEntregaDias: fornecedor.prazoEntregaDias?.toString() ?? "",
                  valorMinimoPedido: fornecedor.valorMinimoPedido
                    ? formatarDecimalBr(fornecedor.valorMinimoPedido.toString())
                    : "",
                  frete: fornecedor.frete
                    ? formatarDecimalBr(fornecedor.frete.toString())
                    : "",
                }}
              />
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-base sm:grid-cols-2">
              <div>
                <dt className="text-sm text-zinc-500">Nome</dt>
                <dd className="font-medium text-zinc-900">{fornecedor.nome}</dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Contato</dt>
                <dd className="font-medium text-zinc-900">
                  {fornecedor.contato || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Prazo de entrega</dt>
                <dd className="font-medium text-zinc-900">
                  {fornecedor.prazoEntregaDias !== null
                    ? `${fornecedor.prazoEntregaDias} dias`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Pedido mínimo</dt>
                <dd className="font-medium text-zinc-900">
                  {formatarMoedaOpcional(fornecedor.valorMinimoPedido)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Frete</dt>
                <dd className="font-medium text-zinc-900">
                  {formatarMoedaOpcional(fornecedor.frete)}
                </dd>
              </div>
            </dl>
          )
        }
        produtos={
          <section>
            <h2 className="text-base font-semibold text-zinc-900">
              Produtos deste fornecedor
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              O vínculo guarda o código usado pelo fornecedor e seu status.
            </p>

            {podeVincular && (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
                <h3 className="text-base font-semibold text-zinc-900">
                  Vincular produto
                </h3>
                <div className="mt-3">
                  <FormularioVinculo
                    fornecedorId={fornecedor.id}
                    opcoes={produtosParaVincular}
                    retorno={`${retorno}?vinculo=1&aba=produtos`}
                  />
                </div>
              </div>
            )}

            <div className="mt-4">
              <ListaVinculos
                podeGerenciarVinculo={podeVincular}
                precosAtuais={mapaPrecos}
                mostrarHistoricoPreco={false}
                vinculos={vinculos.map((item) => ({
                  id: item.id,
                  ativo: item.ativo,
                  codigoNoFornecedor: item.codigoNoFornecedor,
                  produtoId: item.produtoId,
                  fornecedorId: item.fornecedorId,
                  nome: item.produto.nome,
                }))}
                historico={historico.map((item) => ({
                  id: item.id,
                  produtoId: item.produtoId,
                  fornecedorId: item.fornecedorId,
                  precoUnitario: item.precoUnitario.toString(),
                  data: item.data,
                  origem: item.origem,
                  nomePar: item.produto.nome,
                }))}
              />
            </div>
          </section>
        }
        precos={
          <section>
            <h2 className="text-base font-semibold text-zinc-900">
              Histórico de preços
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Cotações informadas e preços registrados em compras, do mais
              recente ao mais antigo.
            </p>

            {podeCotar && (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
                <h3 className="text-base font-semibold text-zinc-900">
                  Registrar preço cotado
                </h3>
                <div className="mt-3">
                  <FormularioPrecoCotado
                    fornecedorId={fornecedor.id}
                    opcoes={produtosParaPreco}
                    retorno={`${retorno}?preco=1&aba=precos`}
                  />
                </div>
              </div>
            )}

            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
              <table className="w-full min-w-140 border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-700">
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Produto
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Preço
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Origem
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historico.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-5 text-center text-zinc-600">
                        Nenhum preço registrado para este fornecedor.
                      </td>
                    </tr>
                  ) : (
                    historico.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-zinc-100 last:border-0"
                      >
                        <td className="px-3 py-3 text-zinc-900">
                          {item.produto.nome}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-zinc-800">
                          {formatarMoeda(item.precoUnitario.toString())}
                        </td>
                        <td className="px-3 py-3 text-zinc-800">
                          {ROTULO_ORIGEM_PRECO[item.origem]}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-zinc-800">
                          {formatarDataPreco(item.data)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        }
      />

      {podeDesativar && (
        <form
          action={fornecedor.ativo ? desativarFornecedor : reativarFornecedor}
          className="mt-4"
        >
          <input type="hidden" name="id" value={fornecedor.id} />
          <BotaoAcao className="h-12 rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900">
            {fornecedor.ativo ? "Desativar fornecedor" : "Reativar fornecedor"}
          </BotaoAcao>
        </form>
      )}
    </main>
  );
}

"use client";

// ============================================================
// Módulo 1 - Módulos e Permissões: matriz (componente de cliente)
// A matriz NÃO tem lista fixa: ela é montada a partir do catálogo
// recebido do servidor (módulo -> funcionalidade -> operação).
// Aqui ficam só a busca de usuário, as caixas de seleção e os
// botões de salvar/cancelar, além do botão "Copiar permissões".
// ============================================================

import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState, useTransition } from "react";

import { buscarPermissoesDeUsuario, salvarPermissoes } from "./actions";
import {
  type EstadoPermissoes,
  type ModuloDaMatriz,
  type UsuarioParaBusca,
  type UsuarioSelecionado,
} from "./tipos";

type Props = {
  usuarios: UsuarioParaBusca[];
  usuarioSelecionado: UsuarioSelecionado | null;
  modulos: ModuloDaMatriz[];
  codigosConcedidos: string[];
  // Se false, o usuário logado pode ver, mas não pode alterar
  podeConceder: boolean;
};

export default function MatrizPermissoes({
  usuarios,
  usuarioSelecionado,
  modulos,
  codigosConcedidos,
  podeConceder,
}: Props) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = usuarios.filter(
    (usuario) =>
      termo === "" ||
      usuario.nome.toLowerCase().includes(termo) ||
      usuario.email.toLowerCase().includes(termo)
  );

  function selecionar(usuario: UsuarioParaBusca) {
    iniciarTransicao(() => {
      router.push(`/permissoes?usuario=${usuario.id}`);
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Busca para selecionar o usuário */}
      <section className="rounded-xl border border-zinc-200 bg-white p-3">
        <label htmlFor="buscaUsuario" className="text-base font-medium text-zinc-800">
          Usuário
        </label>
        <input
          id="buscaUsuario"
          type="search"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar por nome ou e-mail"
          className="mt-1 h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900"
        />

        {pendente && (
          <p role="status" className="mt-2 text-sm text-zinc-600">
            Carregando usuário...
          </p>
        )}

        {filtrados.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            Nenhum usuário encontrado.
          </p>
        ) : (
          <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
            {filtrados.map((usuario) => {
              const selecionado = usuario.id === usuarioSelecionado?.id;
              return (
                <li key={usuario.id}>
                  <button
                    type="button"
                    onClick={() => selecionar(usuario)}
                    disabled={pendente}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60 ${
                      selecionado
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-base font-medium">
                        {usuario.nome}
                      </span>
                      <span
                        className={`block truncate text-sm ${
                          selecionado ? "text-zinc-300" : "text-zinc-600"
                        }`}
                      >
                        {usuario.email}
                      </span>
                    </span>
                    {!usuario.ativo && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          selecionado
                            ? "bg-white/20 text-white"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        Inativo
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {usuarioSelecionado ? (
        // A chave reinicia o formulário (e as caixas) ao trocar de usuário
        <FormularioPermissoes
          key={usuarioSelecionado.id}
          usuario={usuarioSelecionado}
          usuarios={usuarios}
          modulos={modulos}
          codigosConcedidos={codigosConcedidos}
          podeConceder={podeConceder}
        />
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-base text-zinc-600">
          Selecione um usuário acima para ver e alterar as permissões dele.
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Formulário com a matriz do usuário escolhido
// ------------------------------------------------------------
type PropsFormulario = {
  usuario: UsuarioSelecionado;
  usuarios: UsuarioParaBusca[];
  modulos: ModuloDaMatriz[];
  codigosConcedidos: string[];
  podeConceder: boolean;
};

function FormularioPermissoes({
  usuario,
  usuarios,
  modulos,
  codigosConcedidos,
  podeConceder,
}: PropsFormulario) {
  // Códigos marcados agora. É estado (e não defaultChecked) porque
  // o botão "Copiar permissões" precisa remarcar as caixas na hora.
  const [selecionadas, setSelecionadas] = useState(
    () => new Set(codigosConcedidos)
  );
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [copiarAberto, setCopiarAberto] = useState(false);
  const [avisoCopia, setAvisoCopia] = useState<string | null>(null);

  const [estado, enviarFormulario, salvando] = useActionState<
    EstadoPermissoes,
    FormData
  >(salvarPermissoes, {});

  const totalOperacoes = useMemo(
    () =>
      modulos.reduce(
        (soma, modulo) =>
          soma +
          modulo.funcionalidades.reduce(
            (subtotal, funcionalidade) => subtotal + funcionalidade.operacoes.length,
            0
          ),
        0
      ),
    [modulos]
  );

  function alternarModulo(nome: string) {
    setAbertos((anterior) => ({
      ...anterior,
      [nome]: !(anterior[nome] ?? true),
    }));
  }

  function alternarOperacao(codigo: string, marcado: boolean) {
    setSelecionadas((anterior) => {
      const proximo = new Set(anterior);
      if (marcado) proximo.add(codigo);
      else proximo.delete(codigo);
      return proximo;
    });
  }

  function descartar() {
    setSelecionadas(new Set(codigosConcedidos));
    setAvisoCopia(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        action={enviarFormulario}
        onSubmit={() => setAvisoCopia(null)}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="usuarioId" value={usuario.id} />

        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <h2 className="text-base font-semibold text-zinc-900">{usuario.nome}</h2>
          <p className="text-sm text-zinc-600">{usuario.email}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {selecionadas.size} permissão(ões) concedida(s) de {totalOperacoes}.
          </p>

          {podeConceder && (
            <button
              type="button"
              onClick={() => setCopiarAberto(true)}
              disabled={salvando}
              className="mt-3 h-11 rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900 disabled:opacity-60"
            >
              Copiar permissões
            </button>
          )}
        </div>

        {avisoCopia && (
          <p role="status" className="rounded-lg bg-blue-50 p-3 text-base text-blue-800">
            {avisoCopia}
          </p>
        )}

        {estado.erroGeral && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-base text-red-700">
            {estado.erroGeral}
          </p>
        )}

        {!podeConceder && (
          <p className="rounded-lg bg-amber-50 p-3 text-base text-amber-800">
            Você pode consultar as permissões, mas não tem permissão para
            alterá-las.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {modulos.map((modulo) => {
            const aberto = abertos[modulo.nome] ?? true;
            const concedidasNoModulo = modulo.funcionalidades.reduce(
              (soma, funcionalidade) =>
                soma +
                funcionalidade.operacoes.filter((operacao) =>
                  selecionadas.has(operacao.codigo)
                ).length,
              0
            );

            return (
              <section
                key={modulo.nome}
                className="rounded-xl border border-zinc-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => alternarModulo(modulo.nome)}
                  aria-expanded={aberto}
                  className="flex w-full items-center justify-between gap-3 p-3 text-left"
                >
                  <span className="text-base font-semibold text-zinc-900">
                    {modulo.nome}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                      {concedidasNoModulo} concedida(s)
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className={`h-5 w-5 text-zinc-500 transition-transform ${
                        aberto ? "rotate-90" : ""
                      }`}
                    >
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </span>
                </button>

                {aberto && (
                  <div className="flex flex-col gap-4 border-t border-zinc-100 p-3">
                    {modulo.funcionalidades.map((funcionalidade) => (
                      <div key={funcionalidade.nome}>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                          {funcionalidade.nome}
                        </h3>

                        <ul className="mt-2 flex flex-col gap-2">
                          {funcionalidade.operacoes.map((operacao) => (
                            <li key={operacao.codigo}>
                              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50">
                                <input
                                  type="checkbox"
                                  name="permissao"
                                  value={operacao.codigo}
                                  checked={selecionadas.has(operacao.codigo)}
                                  onChange={(evento) =>
                                    alternarOperacao(
                                      operacao.codigo,
                                      evento.target.checked
                                    )
                                  }
                                  disabled={!podeConceder}
                                  className="mt-0.5 h-5 w-5"
                                />
                                <span className="min-w-0">
                                  <span className="block text-base font-medium text-zinc-900">
                                    {operacao.operacao}
                                  </span>
                                  <span className="block text-sm text-zinc-600">
                                    {operacao.descricao}
                                  </span>
                                  <span className="block text-xs text-zinc-400">
                                    {operacao.codigo}
                                  </span>
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {podeConceder && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={salvando}
              className="h-12 rounded-lg bg-zinc-900 px-5 text-base font-medium text-white disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
            <button
              type="button"
              onClick={descartar}
              disabled={salvando}
              className="h-12 rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-900 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        )}
      </form>

      {copiarAberto && (
        <PopupCopiarPermissoes
          usuarios={usuarios}
          usuarioDestino={usuario}
          aoCopiar={(codigos, origemNome) => {
            setSelecionadas(codigos);
            setAvisoCopia(
              `Permissões de "${origemNome}" copiadas. Revise e clique em "Salvar alterações" para confirmar.`
            );
          }}
          aoFechar={() => setCopiarAberto(false)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Popup para escolher de qual usuário copiar as permissões.
// A lista mostra todos, menos o usuário que está sendo editado.
// ------------------------------------------------------------
type PropsPopupCopiar = {
  usuarios: UsuarioParaBusca[];
  usuarioDestino: UsuarioSelecionado;
  aoCopiar: (codigos: Set<string>, origemNome: string) => void;
  aoFechar: () => void;
};

function PopupCopiarPermissoes({
  usuarios,
  usuarioDestino,
  aoCopiar,
  aoFechar,
}: PropsPopupCopiar) {
  const [busca, setBusca] = useState("");
  const [carregando, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const termo = busca.trim().toLowerCase();
  const filtrados = usuarios.filter(
    (usuario) =>
      usuario.id !== usuarioDestino.id &&
      (termo === "" ||
        usuario.nome.toLowerCase().includes(termo) ||
        usuario.email.toLowerCase().includes(termo))
  );

  function escolher(usuario: UsuarioParaBusca) {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await buscarPermissoesDeUsuario(usuario.id);
      if ("erro" in resultado) {
        setErro(resultado.erro);
        return;
      }
      aoCopiar(new Set(resultado.codigos), usuario.nome);
      aoFechar();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Copiar permissões"
        className="max-h-full w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-zinc-900">
            Copiar permissões
          </h3>
          <button
            type="button"
            onClick={aoFechar}
            className="h-11 rounded-lg border border-zinc-300 px-3 text-base font-medium text-zinc-900"
          >
            Fechar
          </button>
        </div>

        <p className="mt-2 text-sm text-zinc-500">
          Escolha de quem copiar. As permissões de {usuarioDestino.nome} serão
          substituídas pelas do usuário escolhido.
        </p>

        <input
          type="search"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar por nome ou e-mail"
          className="mt-3 h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900"
        />

        {erro && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-base text-red-700">
            {erro}
          </p>
        )}

        {carregando && (
          <p role="status" className="mt-3 text-sm text-zinc-600">
            Copiando permissões...
          </p>
        )}

        {filtrados.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            Nenhum outro usuário encontrado.
          </p>
        ) : (
          <ul className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto">
            {filtrados.map((usuario) => (
              <li key={usuario.id}>
                <button
                  type="button"
                  onClick={() => escolher(usuario)}
                  disabled={carregando}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium">
                      {usuario.nome}
                    </span>
                    <span className="block truncate text-sm text-zinc-600">
                      {usuario.email}
                    </span>
                  </span>
                  {!usuario.ativo && (
                    <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      Inativo
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

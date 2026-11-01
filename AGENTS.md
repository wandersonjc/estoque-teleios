<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Largura e responsividade das páginas

- Em páginas e módulos com conteúdo de tela, use um contêiner principal centralizado, fluido e limitado a `max-w-7xl` (80rem/1280px) em telas desktop, com espaçamento lateral adequado.
- Em tablets e celulares, mantenha o contêiner em `w-full` e reorganize o conteúdo com breakpoints para evitar cortes, sobreposição e rolagem horizontal da página.
- Tabelas largas devem conter a rolagem horizontal em sua própria área ou oferecer uma apresentação adaptada a telas menores; não deixe que ampliem a página inteira.
- Mantenha limites menores em formulários, cartões, diálogos e outros componentes compactos quando forem intencionais, sem restringir por acidente o contêiner principal da página.
- Aplique esta convenção também a novas páginas e módulos, preservando a consistência com as telas existentes.

## Navegação para edição

- Links de ação que abrem a edição de um registro devem usar `LinkAcaoComCarregamento` (`src/components/LinkAcaoComCarregamento.tsx`): ao iniciar a navegação, substituem o ícone por loading e ficam desabilitados para cliques repetidos.
- Preserve o tamanho fixo do botão durante o loading e forneça um `ariaLabel` que identifique o registro editado.

## Filtros de inativos

- Checkboxes “Mostrar inativos” em filtros GET devem usar `CheckboxEnvioAutomatico` (`src/components/CheckboxEnvioAutomatico.tsx`), que serializa os campos do formulário e navega com `router.push` para atualizar a lista sem recarregar o documento.
- Preserve os demais filtros do formulário; o valor marcado deve ser enviado e, ao desmarcar, o parâmetro deve ser omitido.
- Monte a query a partir dos valores do formulário antes de desabilitar qualquer campo, pois campos desabilitados não são incluídos nos dados enviados.

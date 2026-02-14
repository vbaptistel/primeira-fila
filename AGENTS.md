# AGENTS.md

## Objetivo
Este arquivo define instruções para agentes de IA que atuam neste repositório.
Siga estas regras para manter consistência arquitetural, qualidade técnica e alinhamento com a documentação oficial.

## Contexto do Projeto
- Produto: plataforma white-label de venda de ingressos.
- Idioma oficial: Português-BR.
- Documentação fonte de verdade: `docs/`.
- Modelo de execução atual: **síncrono** (sem filas, sem workers, sem mensageria).

## Arquitetura Obrigatória
- Estrutura principal:
  - `backend/` (API e regras de negócio).
  - `frontend/apps/web-customer` (experiência do comprador).
  - `frontend/apps/web-backoffice` (operação do organizador).
  - `frontend/packages/shared` (compartilhado apenas entre frontends).
- É proibido compartilhar código-fonte entre backend e frontend.
- Integração backend/frontend ocorre apenas por HTTP/JSON (contrato OpenAPI).

## Restrições Técnicas
- Não introduzir filas, jobs assíncronos, outbox, workers ou Redis nesta fase.
- Não duplicar regra de negócio no frontend.
- Backend deve centralizar validações e regras transacionais.

## Stack Oficial
- Linguagem principal: TypeScript.
- Backend: Node.js + NestJS (Fastify) + Prisma + PostgreSQL (Supabase).
- Autenticação: Supabase Auth (tokens JWT + RBAC por tenant no backend).
- Frontend: Next.js 16 + React 19 + `shadcn/ui`.
- Qualidade: ESLint, TypeScript strict, testes de arquitetura.

## Deploy
- Backend: Vercel com integração nativa do repositório.
- Frontend: Vercel com integração nativa do repositório.
- Não criar workflows de deploy no GitHub Actions (backend ou frontend).

## Comandos Padrão
Executar da raiz do repositório:

```bash
npm install
npm run lint
npm run typecheck
npm run test:arch
npm run build
```

Executar aplicações:

```bash
npm run dev --workspace @primeira-fila/backend
npm run dev --workspace web-customer
npm run dev --workspace web-backoffice
```

## Regras de Qualidade para Mudanças
- Fazer alterações pequenas e focadas.
- Manter compatibilidade com as decisões dos documentos:
  - `docs/11-stack-linguagens-frameworks.md`
  - `docs/12-divisao-aplicacoes-monorepo.md`
  - `docs/13-padroes-engenharia-qualidade.md`
  - `docs/16-tasks-implementacao-mvp.md`
- Sempre validar `lint`, `typecheck` e `test:arch` após mudanças relevantes.

## Atualização de Backlog e Documentação
- Ao concluir task, atualizar status no `docs/16-tasks-implementacao-mvp.md`.
- Registrar mudanças relevantes no changelog dos documentos impactados.
- Manter textos com acentuação correta em Português-BR.

## Segurança e Operação
- Não usar comandos destrutivos sem solicitação explícita.
- Não vazar segredos em código, logs ou documentação.
- Preferir configuração por variáveis de ambiente.

## Checklist Antes de Encerrar uma Entrega
1. Código compila e passa em `lint`, `typecheck` e `test:arch`.
2. Fronteiras backend/frontend continuam respeitadas.
3. Documentação e status das tasks estão atualizados.
4. Não houve introdução de componentes assíncronos fora do escopo atual.

## Do / Don't

### Do
- Respeitar a separação entre `backend/` e `frontend/`.
- Implementar regras de negócio no backend.
- Atualizar documentação e status de task na mesma entrega.
- Executar validações locais antes de encerrar (`lint`, `typecheck`, `test:arch`).

### Don't
- Não importar código de `backend/` dentro de `frontend/` (e vice-versa).
- Não adicionar filas, workers, mensageria ou outbox.
- Não criar pipeline de deploy no GitHub Actions.
- Não alterar stack oficial sem registrar decisão técnica (ADR).

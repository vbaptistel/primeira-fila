# Documento 11 - Stack, Linguagens e Frameworks

## Objetivo
Definir stack técnica oficial do projeto para padronizar desenvolvimento, operação e manutenção.

## Contexto
As escolhas abaixo priorizam velocidade de entrega com segurança operacional e boa base para evolução do produto.

## Decisões Fechadas
- Linguagem principal: TypeScript.
- Estrutura separada: `backend/` e `frontend/`.
- Backend único: API + regras de negócio em um único serviço.
- Frontend: duas aplicações Next.js com pacote compartilhado exclusivo de frontend.
- Não haverá compartilhamento de código-fonte entre backend e frontend.

## Stack Backend
- Runtime: Node.js 22 LTS.
- Framework HTTP: NestJS (adaptador Fastify).
- ORM: Prisma ORM.
- Banco relacional: PostgreSQL gerenciado no Supabase.
- Validação: `class-validator` + `class-transformer`.
- Contratos de API: OpenAPI (Swagger).
- Autenticação: Supabase Auth (access token JWT + refresh token).
- Autorização: RBAC por tenant.
- Processamento interno: síncrono.

## Stack Frontend
- Framework: Next.js 16 (App Router) + React 19.
- Aplicações: `web-customer` e `web-backoffice`.
- UI: `shadcn/ui` com base compartilhada em `frontend/packages/shared`.
- Estado e dados: Server Components + TanStack Query + Zustand (mínimo).
- Formulários e validação: React Hook Form + Zod.
- Autenticação no cliente: sessão Supabase Auth com cookies seguros (`HttpOnly`) e renovação via provider.

## Contratos Backend-Frontend
- Integração via HTTP/JSON e contrato OpenAPI publicado pelo backend.
- Frontend pode gerar cliente tipado localmente a partir do OpenAPI.
- É proibido importar módulos do backend diretamente no frontend.

## Qualidade e Ferramentas
- Lint: ESLint.
- Formatação: Prettier.
- Testes unitários: Vitest.
- Testes de integração API: Vitest + Supertest.
- Testes E2E: Playwright.
- Commits: Conventional Commits.

## Observabilidade e Operação
- Logs estruturados em JSON.
- Monitoramento backend: Vercel Observability + dashboards operacionais.
- Dashboards operacionais: erro 5xx, latência p95, disponibilidade e falhas de integração.
- Correlação de requisições por `trace_id`.

## Deploy
### Backend
- Build: `npm run build` do workspace backend.
- CI: GitHub Actions apenas para qualidade de código.
- Deploy: integração nativa da Vercel.
- Plataforma: Vercel.

### Frontend
- Plataforma: Vercel.
- Deploy independente por aplicação (`web-customer` e `web-backoffice`).

## Regras e Critérios de Aceite
- Código novo deve seguir stack oficial sem tecnologias paralelas não aprovadas.
- Bibliotecas fora da lista precisam de ADR curta com justificativa.
- Backend e frontend devem compilar, testar e lintar de forma independente em CI.

## Riscos e Limitações
- Operações demoradas devem ser tratadas com timeout e fallback controlado.
- Evolução de framework exige controle de breaking changes com janela de rollout.

## Changelog
- `v2.3.0` - 2026-02-14 - Definição do Supabase Auth como provider oficial de autenticação.
- `v2.2.0` - 2026-02-14 - Definição do banco oficial como PostgreSQL gerenciado no Supabase.
- `v2.1.0` - 2026-02-14 - Remoção de menções a componentes de execução paralela no backend.
- `v2.0.0` - 2026-02-14 - Alinhamento com stack final: PostgreSQL, Next.js 16, shadcn/ui e deploy em Vercel.
- `v1.1.0` - 2026-02-14 - Ajuste para backend único, dois frontends Next.js e fronteira rígida sem compartilhamento de código.
- `v1.0.0` - 2026-02-14 - Definição inicial da stack técnica oficial.

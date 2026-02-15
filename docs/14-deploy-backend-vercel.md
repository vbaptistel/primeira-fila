# Documento 14 - Deploy do Backend na Vercel

## Objetivo
Definir arquitetura, fluxo e runbook de deploy do backend na Vercel para o MVP.

## Contexto
Backend único em NestJS, com processamento totalmente síncrono nesta fase, publicado diretamente na Vercel com integração nativa do repositório e rollback por redeploy da versão estável anterior.

## Decisões Fechadas
- Plataforma de execução: Vercel.
- Modelo de deploy: integração nativa com Git (sem pipeline de deploy no GitHub Actions).
- Estratégia de release: deploy automático da branch principal em produção.
- Ambientes: `preview` para PR/branches e `production` para `main`.
- Rollback: promoção/redeploy manual de deployment anterior estável.
- Banco: PostgreSQL gerenciado no Supabase, acessado por variável de ambiente.
- Provider de autenticação: Supabase Auth.
- Observabilidade: logs estruturados + métricas operacionais com correlação por `trace_id`.

## Arquitetura de Deploy (MVP)
- Projeto Vercel dedicado para `backend/`.
- Build executado pelo pipeline nativo da Vercel.
- Variáveis de ambiente separadas por ambiente (`preview` e `production`).
- CI do GitHub Actions mantido apenas para qualidade de código backend (lint, typecheck e build).

## Configuração de Runtime
- Endpoint de saúde obrigatório: `/health`.
- Configuração de CORS alinhada aos domínios dos frontends.
- Timeout e limites de payload compatíveis com fluxos síncronos do MVP.
- Variáveis sensíveis gerenciadas apenas no painel/CLI da Vercel.

## Configuração de Autenticação (Supabase Auth)
- Backend valida tokens JWT do Supabase Auth em todas as rotas protegidas.
- Claims mínimas para autorização: `sub`, `role` e `tenant_id`.
- Segredos e chaves do provider segregados por ambiente (`preview` e `production`).

### Variáveis de ambiente Supabase (backend)

O backend usa apenas **verificação local do JWT** (`auth.getClaims(token)`), sem chamar a API do Auth. Por isso são necessárias só as variáveis abaixo. **Não** é necessário configurar a secret key (service_role) nem JWT secret no backend para essa verificação.

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `SUPABASE_URL` | Sim* | URL do projeto (ex.: `https://xxxx.supabase.co`). Preferir no backend; alternativamente `NEXT_PUBLIC_SUPABASE_URL`. |
| `SUPABASE_PUBLISHABLE_KEY` | Sim* | Chave **Publishable** (nova, prefixo `sb_publishable_...`). Segura para uso no backend só para verificação de JWT. Alternativamente `SUPABASE_ANON_KEY` (legacy anon). |
| `AUTH_JWT_INSECURE_DECODE` | Não | Se `true`, apenas decodifica o payload do JWT sem verificar assinatura (apenas para desenvolvimento/local). |

\* Exceto se `AUTH_JWT_INSECURE_DECODE=true` (modo inseguro).

**Não usar no backend para este fluxo:** `SUPABASE_SERVICE_ROLE_KEY` / secret key (privilegiada; só se o backend precisar de operações admin no Auth). O verifier atual não a utiliza.

## Configuração do PostgreSQL (Supabase)
- Conexão obrigatória com SSL (`sslmode=require`).
- Credenciais distintas por ambiente (`preview` e `production`) quando aplicável.
- Usuário de aplicação com privilégio mínimo necessário.
- Projeto Supabase dedicado ao ambiente de produção do MVP.
- Migrações executadas de forma controlada antes da promoção de release crítica.

## Baseline de Segurança do Supabase (TASK-042)
- Role de runtime dedicada para o backend (sem privilégios administrativos).
- Revogação de privilégios amplos de `PUBLIC` no schema `public`.
- Revogação de grants para `anon`/`authenticated` em tabelas existentes.
- Habilitação de `RLS` + `FORCE RLS` em tabelas existentes.
- Padrão automático em novas tabelas com event trigger (`RLS` + `FORCE RLS` + revoke para `anon`/`authenticated`).
- Grants mínimos para tabelas e sequências do schema de aplicação.
- `DATABASE_URL` com SSL obrigatório e sem credenciais de administrador.
- Rotação periódica de senha da role de runtime e atualização de segredo na Vercel.
- Referência versionada: `backend/prisma/sql/supabase-security-baseline.sql`.
- Comando de aplicação (com credencial administrativa):
  - `psql "$DATABASE_URL" -f backend/prisma/sql/supabase-security-baseline.sql`

### Checklist Operacional de Segurança (TASK-042)
- [x] Projeto Supabase provisionado para produção.
- [x] Baseline SQL de privilégios mínimos versionado no repositório.
- [x] Baseline SQL executado no ambiente Supabase de produção.
- [x] Revisão final de roles e grants registrada em evidência operacional.

Evidência operacional registrada (2026-02-14):
- Execução do baseline com retorno `REVOKE`, `REVOKE`, `ALTER DEFAULT PRIVILEGES`, `ALTER DEFAULT PRIVILEGES`.
- Verificação de ACL:
  - schema `public` sem privilégio de `CREATE` para `PUBLIC` (apenas `USAGE`);
  - database `postgres` sem grants amplos para `PUBLIC`;
  - default privileges no schema `public` revisados para os roles administrativos.
- Verificação adicional do padrão de segurança:
  - tabelas `events`, `event_days` e `sessions` com `RLS` e `FORCE RLS` ativos;
  - sem grants de tabela para `anon` e `authenticated` nessas tabelas;
  - event trigger `trg_enforce_public_table_security` ativo;
  - prova de criação de tabela nova validou `RLS` + `FORCE RLS` + ausência de grants para `anon`/`authenticated`.

## Fluxo de Deploy
1. `push` na branch principal dispara build/deploy automático em produção na Vercel.
2. Vercel executa instalação de dependências e build do backend.
3. Deploy é publicado e recebe URL/versionamento da plataforma.
4. Smoke test mínimo em `/health` e endpoint crítico de leitura.
5. Registro da versão liberada no changelog operacional do time.

## Smoke Test Pós-Deploy (TASK-045)
- Script oficial: `scripts/smoke-backend.mjs`.
- Comando padrão:
  - `npm run smoke:backend -- --base-url=https://<backend-url>`
- Endpoints verificados no baseline:
  - `/health` (saúde do serviço);
  - `/docs-json` (endpoint crítico de leitura no estágio atual do backend).
- Endpoint crítico pode ser sobrescrito:
  - `npm run smoke:backend -- --base-url=https://<backend-url> --critical-path=/v1/<endpoint>`

Evidência operacional registrada (2026-02-14):
- Smoke test executado com sucesso em `https://primeira-fila-backend.vercel.app`.
- Resultados:
  - `OK - Health check passou.`
  - `OK - Endpoint crítico de leitura passou.`

## Estratégia de Rollback
- Critérios de rollback:
  - aumento sustentado de erro 5xx;
  - degradação de latência fora de SLO;
  - falha funcional crítica em compra, emissão ou check-in.
- Ação de rollback:
  1. Identificar último deployment estável em produção.
  2. Executar promoção/redeploy desse deployment na Vercel.
  3. Confirmar saúde em `/health` e fluxo crítico.
  4. Registrar incidente e causa raiz preliminar.

## Observabilidade Operacional
- Logs estruturados em JSON com `trace_id`.
- Acompanhamento mínimo:
  - taxa de erro 5xx;
  - latência p95;
  - disponibilidade;
  - falhas de integração com gateway.
- Alertas operacionais configurados para violações de SLO.

## Segurança
- Sem segredos versionados no repositório.
- Variáveis de ambiente segregadas por ambiente na Vercel.
- Branch principal protegida com revisão obrigatória.
- Secret scanning e SAST mantidos no fluxo de qualidade.

## Regras e Critérios de Aceite
- Deploy de produção somente via integração nativa da Vercel.
- Nenhuma liberação sem smoke test mínimo aprovado.
- Rollback por redeploy deve estar documentado e testado.
- Monitoramento ativo com alertas no go-live.

## Riscos e Limitações
- Dependência da plataforma única de deploy no MVP.
- Mudanças de configuração em produção exigem controle rigoroso de variáveis.
- Deploy em horário de pico aumenta risco operacional em caso de regressão.

## Changelog
- `v2.4.0` - 2026-02-14 - Baseline reforçado com padrão automático de segurança para novas tabelas no Supabase (`RLS` + `FORCE RLS` + revoke para `anon`/`authenticated`).
- `v2.3.0` - 2026-02-14 - Inclusão de baseline de segurança Supabase e automação de smoke test pós-deploy.
- `v2.2.0` - 2026-02-14 - Inclusão do Supabase Auth como provider oficial de autenticação.
- `v2.1.0` - 2026-02-14 - Atualização do banco para PostgreSQL gerenciado no Supabase.
- `v2.0.0` - 2026-02-14 - Migração do padrão de deploy backend para Vercel com rollback por redeploy.
- `v1.0.0` - 2026-02-14 - Definição inicial do padrão de deploy backend.

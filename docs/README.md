# Documentação Geral - Plataforma White-label de Ingressos (MVP)

## Objetivo
Centralizar a documentação oficial do MVP para produto, engenharia e operação, com rastreabilidade de decisões e critérios de aceite mensuráveis.

## Contexto
Projeto white-label de venda de ingressos para organizadores no Brasil, com foco inicial em web responsivo, um gateway de pagamento e confiabilidade operacional.

## Sumário
1. `docs/01-visao-produto.md`
2. `docs/02-escopo-mvp.md`
3. `docs/03-modelo-dominio.md`
4. `docs/04-arquitetura-alto-nivel.md`
5. `docs/05-contratos-api-v1.md`
6. `docs/06-fluxos-usuario.md`
7. `docs/07-nfrs-slos.md`
8. `docs/08-roadmap-fases.md`
9. `docs/09-politicas-comerciais-financeiras.md`
10. `docs/10-padroes-arquitetura-tecnica.md`
11. `docs/11-stack-linguagens-frameworks.md`
12. `docs/12-divisao-aplicacoes-monorepo.md`
13. `docs/13-padroes-engenharia-qualidade.md`
14. `docs/14-deploy-backend-vercel.md`
15. `docs/15-estorias-mvp.md`
16. `docs/16-tasks-implementacao-mvp.md`

## Complementos Técnicos
- ADRs: `docs/adr/README.md`
- Template ADR: `docs/adr/0000-template.md`

## Convenções
- Idioma oficial: Português-BR.
- Formato: Markdown com template fixo.
- Diagramas: Mermaid quando houver ganho de clareza.
- API base: `/v1`.
- Isolamento multi-tenant: obrigatório por `tenant_id`.

## Regras de Consistência
- Domínio, APIs e fluxos devem usar os mesmos estados de negócio.
- Metas de produto (Documento 1) devem ser operacionalizadas por NFR/SLO (Documento 7).
- Critérios de fase (Documento 8) devem depender de critérios técnicos e funcionais dos documentos anteriores.
- Regras de taxas, reembolso e repasse devem seguir o Documento 9.
- Tenant sem política customizada deve operar com `platform_default_v1`.
- Escolhas de stack e organização de código devem seguir os Documentos 10 a 14.
- Estórias e backlog de execução devem seguir os Documentos 15 e 16.
- Backend e frontend devem permanecer separados, sem compartilhamento de código-fonte entre eles.

## Fluxo de Revisão
1. Produto valida intenção, escopo e metas.
2. Engenharia valida viabilidade técnica, contratos e riscos.
3. Operação valida executabilidade em evento real.

## Critérios de Aceite do Pacote
- Não há conflitos semânticos entre os documentos.
- Cada documento possui critérios objetivos de aceite.
- Toda decisão relevante tem owner (papel) e forma de medição.

## Riscos e Limitações
- Decisões de roadmap e NFR podem evoluir após dados reais de piloto.
- Integrações externas podem exigir refinamentos de contrato.

## Changelog
- `v3.6.0` - 2026-02-14 - Avanço da Sprint 04 com conclusão da `TASK-008` (hold de assentos com TTL de 10 minutos e expiração síncrona no backend).
- `v3.5.0` - 2026-02-14 - Avanço da Sprint 03 com conclusão da `TASK-007` (mapa de assentos por sessão e endpoint público de assentos).
- `v3.4.0` - 2026-02-14 - Baseline de segurança do Supabase reforçado com padrão automático para novas tabelas (RLS, FORCE RLS e revoke para `anon`/`authenticated`).
- `v3.3.0` - 2026-02-14 - Avanço da Sprint 03 com conclusão da `TASK-006` (módulo de eventos/dias/sessões no backend).
- `v3.2.0` - 2026-02-14 - Evidência de smoke test pós-deploy registrada com backend em produção aprovado.
- `v3.1.0` - 2026-02-14 - Conclusão do baseline de segurança do Supabase (TASK-042) com evidência de ACL/grants.
- `v3.0.0` - 2026-02-14 - Avanço da Fase 2 com baseline de segurança Supabase e smoke test automatizado de backend pós-deploy.
- `v2.9.0` - 2026-02-14 - Definição do Supabase Auth como provider de autenticação e alinhamento de stack, contratos, roadmap e backlog.
- `v2.8.0` - 2026-02-14 - Atualização da base de dados oficial para PostgreSQL gerenciado no Supabase em stack, arquitetura, deploy e backlog.
- `v2.7.0` - 2026-02-14 - Correção da trilha de deploy: backend também em Vercel e atualização cruzada de documentação/tarefas.
- `v2.6.0` - 2026-02-14 - Fechamento da Fase 1 com validação de deploy frontend na Vercel e status de sprint atualizado.
- `v2.5.0` - 2026-02-14 - Ajuste de estratégia de deploy frontend: Vercel nativa sem workflows de deploy no GitHub Actions.
- `v2.4.0` - 2026-02-14 - Início da implementação da Fase 1 no código com monorepo base, pacote compartilhado frontend e validação de fronteiras.
- `v2.3.0` - 2026-02-14 - Definição da ordem de execução das tasks por fases e sprints no Documento 16.
- `v2.2.0` - 2026-02-14 - Inclusão das estórias do MVP e backlog de tasks com coluna de status.
- `v2.1.0` - 2026-02-14 - Remoção completa de menções a execução paralela na documentação técnica.
- `v2.0.0` - 2026-02-14 - Alinhamento final de stack (backend/frontend) e inclusão do padrão de deploy backend.
- `v1.6.0` - 2026-02-14 - Separação explícita backend/frontend e restrição de compartilhamento de código.
- `v1.4.0` - 2026-02-14 - Inclusão da trilha de documentação técnica (arquitetura, stack, apps e qualidade).
- `v1.3.0` - 2026-02-14 - Inclusão de regra global para fallback de política comercial default.
- `v1.2.0` - 2026-02-14 - Inclusão de políticas comerciais e financeiras como documento dedicado.
- `v1.1.0` - 2026-02-14 - Revisão de metas/regras finas e consistência transversal.
- `v1.0.0` - 2026-02-14 - Estrutura inicial completa da documentação.

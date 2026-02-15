# Documento 16 - Tasks de Implementação do MVP

## Objetivo
Detalhar tasks de implementação vinculadas às estórias do MVP, com controle de status e critérios objetivos de conclusão.

## Contexto
Este backlog operacionaliza as estórias do Documento 15 e permite acompanhamento de execução por fase.

## Convenções de Status
- `TODO`
- `EM_ANDAMENTO`
- `BLOQUEADA`
- `CONCLUIDA`

## Backlog de Tasks
| Task ID | Estória | Área | Task | Critério de Conclusão | Dependências | Status |
|---|---|---|---|---|---|---|
| `TASK-001` | `US-014` | Estrutura | Criar estrutura base `backend/` e `frontend/`. | Estrutura de pastas criada conforme Documento 12. | - | `CONCLUIDA` |
| `TASK-002` | `US-014` | Estrutura | Criar `frontend/apps/web-customer`. | App inicia localmente em Next.js 16. | `TASK-001` | `CONCLUIDA` |
| `TASK-003` | `US-014` | Estrutura | Criar `frontend/apps/web-backoffice`. | App inicia localmente em Next.js 16. | `TASK-001` | `CONCLUIDA` |
| `TASK-004` | `US-014` | Estrutura | Criar `frontend/packages/shared` com setup inicial. | Package pode ser importado pelas duas apps frontend. | `TASK-001` | `CONCLUIDA` |
| `TASK-005` | `US-014` | Qualidade | Configurar regra para bloquear import cruzado backend/frontend. | CI falha em import cruzado proibido. | `TASK-001` | `CONCLUIDA` |
| `TASK-006` | `US-006` | Backend | Criar módulo de eventos (`Event`, `EventDay`, `Session`). | CRUD básico funcional com validações. | `TASK-001` | `CONCLUIDA` |
| `TASK-007` | `US-007` | Backend | Criar módulo de mapa de assentos por sessão. | Assentos criados com unicidade por `setor+fileira+número`. | `TASK-006` | `CONCLUIDA` |
| `TASK-008` | `US-002` | Backend | Implementar hold de assento com TTL de 10 minutos. | Hold criado e expirado corretamente. | `TASK-007` | `CONCLUIDA` |
| `TASK-009` | `US-003` | Backend | Implementar criação de pedido com idempotência. | Pedido não duplica com mesma chave idempotente. | `TASK-008` | `CONCLUIDA` |
| `TASK-010` | `US-003` | Backend | Integrar gateway de pagamento (criação e confirmação). | Fluxo de pagamento aprovado/negado funcional. | `TASK-009` | `CONCLUIDA` |
| `TASK-011` | `US-003` | Backend | Implementar webhook idempotente do gateway. | Eventos duplicados não geram inconsistência. | `TASK-010` | `TODO` |
| `TASK-012` | `US-004` | Backend | Implementar emissão de ticket QR após pagamento aprovado. | Ticket `valid` criado somente após pagamento confirmado. | `TASK-010` | `TODO` |
| `TASK-013` | `US-004` | Backend | Criar endpoint de consulta de tickets por pedido. | Buyer acessa apenas tickets permitidos por escopo. | `TASK-012` | `TODO` |
| `TASK-014` | `US-005` | Backend | Implementar endpoint de validação de QR de check-in. | Ticket usado uma vez; segundo uso negado. | `TASK-012` | `TODO` |
| `TASK-015` | `US-011` | Backend | Implementar RBAC por tenant em endpoints críticos com claims do Supabase Auth. | Acesso cruzado bloqueado em testes de integração com token válido/inválido. | `TASK-006` | `CONCLUIDA` |
| `TASK-016` | `US-010` | Backend | Implementar política comercial default `platform_default_v1`. | Tenant novo recebe política default automaticamente. | `TASK-001` | `CONCLUIDA` |
| `TASK-017` | `US-010` | Backend | Versionar política comercial por tenant. | Alteração salva com `version` e `effective_from`. | `TASK-016` | `CONCLUIDA` |
| `TASK-018` | `US-010` | Backend | Registrar snapshot financeiro no pedido. | Pedido persiste valores + versão da política aplicada. | `TASK-009`,`TASK-017` | `CONCLUIDA` |
| `TASK-019` | `US-009` | Backend | Implementar reembolso manual com `reason_code`. | Reembolso respeita matriz e atualiza estados. | `TASK-011`,`TASK-018` | `TODO` |
| `TASK-020` | `US-009` | Backend | Auditar ações de reembolso e check-in. | Auditoria registra ator, timestamp e ação. | `TASK-014`,`TASK-019` | `TODO` |
| `TASK-021` | `US-001` | Frontend Customer | Criar home/listagem de eventos no `web-customer`. | Listagem de sessões públicas funcional. | `TASK-002`,`TASK-006` | `TODO` |
| `TASK-022` | `US-001` | Frontend Customer | Criar página de detalhe de sessão com disponibilidade. | Usuário visualiza preço e disponibilidade atual. | `TASK-021`,`TASK-007` | `TODO` |
| `TASK-023` | `US-002` | Frontend Customer | Implementar seleção de assentos e criação de hold. | Hold gerado com tratamento de conflito/expiração. | `TASK-022`,`TASK-008` | `TODO` |
| `TASK-024` | `US-003` | Frontend Customer | Implementar checkout e pagamento. | Compra finaliza com status consistente do pedido. | `TASK-023`,`TASK-010` | `TODO` |
| `TASK-025` | `US-004` | Frontend Customer | Criar área de pedidos e ingressos do comprador. | Buyer visualiza ticket QR no portal. | `TASK-013`,`TASK-024` | `TODO` |
| `TASK-026` | `US-012` | Frontend | Integrar Supabase Auth para login e sessão no frontend. | Login funcional via provider e sessão segura persistida com cookie `HttpOnly`. | `TASK-015` | `TODO` |
| `TASK-027` | `US-012` | Frontend | Implementar logout e revogação de sessão no Supabase Auth. | Sessão removida no cliente e token inválido para novas chamadas protegidas. | `TASK-026` | `TODO` |
| `TASK-028` | `US-006` | Frontend Backoffice | Criar CRUD de eventos/dias/sessões no backoffice. | Organizer Admin publica sessão com sucesso. | `TASK-003`,`TASK-006` | `TODO` |
| `TASK-029` | `US-007` | Frontend Backoffice | Criar tela de configuração de assentos por sessão. | Assentos criados/bloqueados com validação visual. | `TASK-028`,`TASK-007` | `TODO` |
| `TASK-030` | `US-008` | Frontend Backoffice | Criar tela de consulta de pedidos/pagamentos/ingressos. | Filtros por status/evento/sessão funcionam. | `TASK-003`,`TASK-013` | `TODO` |
| `TASK-031` | `US-005` | Frontend Backoffice | Criar tela operacional de check-in por QR. | Operador valida ingresso e vê resultado em tempo real. | `TASK-014`,`TASK-026` | `TODO` |
| `TASK-032` | `US-009` | Frontend Backoffice | Criar fluxo de reembolso manual. | Organizer Admin solicita reembolso com motivo obrigatório. | `TASK-019`,`TASK-026` | `TODO` |
| `TASK-033` | `US-014` | Frontend Shared | Criar base de componentes `shadcn/ui` em `packages/shared`. | Componentes reutilizados pelas duas apps frontend. | `TASK-004` | `CONCLUIDA` |
| `TASK-034` | `US-014` | Frontend Shared | Criar tokens e tema visual compartilhados. | Tema aplicado de forma consistente em ambas as apps. | `TASK-033` | `CONCLUIDA` |
| `TASK-035` | `US-015` | Backend | Instrumentar logs estruturados com `trace_id`. | Logs possuem correlação de requisição ponta a ponta. | `TASK-001` | `CONCLUIDA` |
| `TASK-036` | `US-015` | Infra | Configurar observabilidade do backend na Vercel. | Métricas e logs de requisição/erro visíveis para operação. | `TASK-039`,`TASK-050` | `TODO` |
| `TASK-037` | `US-015` | Infra | Configurar consultas/filtros de logs operacionais. | Consultas base de suporte publicadas para incidentes. | `TASK-036` | `TODO` |
| `TASK-038` | `US-015` | Infra | Criar alertas de erro e latência. | Alertas ativos para 5xx e degradação p95. | `TASK-036`,`TASK-037` | `TODO` |
| `TASK-039` | `US-013` | Infra | Configurar projeto Vercel do backend com integração nativa do repositório. | Deploy backend acionado automaticamente pela plataforma. | - | `CONCLUIDA` |
| `TASK-040` | `US-013` | Infra | Configurar runtime/build do backend no projeto Vercel. | Build e inicialização do backend concluídos sem erro na Vercel. | `TASK-039` | `CONCLUIDA` |
| `TASK-041` | `US-013` | Infra | Provisionar projeto e banco PostgreSQL no Supabase para produção. | Projeto Supabase criado com banco operacional e conexão SSL ativa. | - | `CONCLUIDA` |
| `TASK-042` | `US-013` | Infra | Configurar segurança de acesso ao PostgreSQL no Supabase. | Baseline de privilégios mínimos versionado e execução validada no ambiente de produção. | `TASK-041` | `CONCLUIDA` |
| `TASK-043` | `US-013` | CI/CD | Manter workflow GitHub Actions para qualidade do backend. | Workflow executa lint, typecheck e build do backend em PR/push. | `TASK-001` | `CONCLUIDA` |
| `TASK-044` | `US-013` | Deploy Backend | Validar deploy automático do backend na Vercel em push na branch principal. | Deploy em `production` funcional e rastreável na Vercel. | `TASK-039`,`TASK-040`,`TASK-050` | `CONCLUIDA` |
| `TASK-045` | `US-013` | Operação | Definir smoke test mínimo pós-deploy backend. | Script e checklist de smoke test (`/health` + endpoint crítico) aplicáveis a cada release. | `TASK-044` | `CONCLUIDA` |
| `TASK-046` | `US-013` | Operação | Documentar procedimento de release de produção na Vercel. | Runbook de deploy publicado e revisado. | `TASK-044` | `CONCLUIDA` |
| `TASK-047` | `US-013` | Operação | Documentar rollback por promoção/redeploy de versão estável na Vercel. | Rollback documentado e validado em simulação. | `TASK-046` | `CONCLUIDA` |
| `TASK-048` | `US-014` | Deploy Frontend | Configurar projeto Vercel do `web-customer` com integração nativa do repositório. | Deploy automático via Vercel em push da branch principal funcional. | `TASK-002` | `CONCLUIDA` |
| `TASK-049` | `US-014` | Deploy Frontend | Configurar projeto Vercel do `web-backoffice` com integração nativa do repositório. | Deploy automático via Vercel em push da branch principal funcional. | `TASK-003` | `CONCLUIDA` |
| `TASK-050` | `US-013` | Segurança | Configurar variáveis de ambiente e segredos do backend na Vercel. | Segredos segregados por ambiente (`preview`/`production`) e sem exposição no repositório. | `TASK-039` | `CONCLUIDA` |
| `TASK-051` | `US-015` | Qualidade | Criar testes de arquitetura para bloquear import cruzado. | Teste automatizado falha em import proibido. | `TASK-005` | `CONCLUIDA` |
| `TASK-052` | `US-003` | Qualidade | Criar testes de integração de idempotência de pagamento. | Cenários duplicados não quebram consistência. | `TASK-010`,`TASK-011` | `TODO` |
| `TASK-053` | `US-002` | Qualidade | Criar testes de concorrência de assentos. | Sem overbooking em cenários concorrentes críticos. | `TASK-008` | `TODO` |
| `TASK-054` | `US-005` | Qualidade | Criar E2E de check-in com duplo uso de QR. | Primeiro uso aprovado; segundo uso negado. | `TASK-031` | `TODO` |
| `TASK-055` | `US-009` | Qualidade | Criar E2E de reembolso manual com validação de política. | Reembolso permitido/negado conforme matriz de regras. | `TASK-032` | `TODO` |
| `TASK-056` | `US-015` | Operação | Criar dashboard operacional inicial (erro, latência, disponibilidade). | Dashboard publicado e revisado com operação. | `TASK-038` | `TODO` |
| `TASK-057` | `US-015` | Operação | Criar playbook de incidente backend. | Playbook documentado e validado pelo time. | `TASK-056` | `TODO` |
| `TASK-058` | `US-010` | Backend | Criar endpoint de consulta de política comercial por tenant. | Endpoint retorna política ativa/default com versão. | `TASK-017` | `CONCLUIDA` |
| `TASK-059` | `US-004` | Backend | Garantir envio de e-mail transacional síncrono com fallback manual. | Falhas registradas e reenvio manual possível no backoffice. | `TASK-012` | `TODO` |
| `TASK-060` | `US-008` | Frontend Backoffice | Criar tela para reenvio manual de e-mail de ingresso. | Operador executa reenvio e registra auditoria da ação. | `TASK-059`,`TASK-030` | `TODO` |

## Sequenciamento por Fases e Sprints
Cadência sugerida: sprints de 2 semanas.

| Ordem | Fase | Sprint | Objetivo | Tasks |
|---|---|---|---|---|
| `1` | Fundação | `Sprint 01` | Estruturar repositório, apps frontend e bases de compartilhamento no frontend. | `TASK-001`,`TASK-002`,`TASK-003`,`TASK-004`,`TASK-005`,`TASK-033`,`TASK-034`,`TASK-048`,`TASK-049`,`TASK-051` |
| `2` | Plataforma | `Sprint 02` | Consolidar deploy backend na Vercel, segurança de ambiente e operação de rollback. | `TASK-039`,`TASK-040`,`TASK-041`,`TASK-042`,`TASK-050`,`TASK-043`,`TASK-044`,`TASK-045`,`TASK-046`,`TASK-047` |
| `3` | Domínio Core | `Sprint 03` | Implementar catálogo de eventos/sessões, RBAC e políticas comerciais versionadas. | `TASK-006`,`TASK-007`,`TASK-015`,`TASK-016`,`TASK-017`,`TASK-058`,`TASK-035` |
| `4` | Checkout Core | `Sprint 04` | Implementar jornada backend de assento, pedido, pagamento, ticket, check-in e reembolso. | `TASK-008`,`TASK-009`,`TASK-010`,`TASK-011`,`TASK-012`,`TASK-013`,`TASK-014`,`TASK-018`,`TASK-019`,`TASK-020`,`TASK-052`,`TASK-053`,`TASK-059` |
| `5` | Experiência Buyer | `Sprint 05` | Entregar jornada completa no `web-customer` com autenticação e tickets. | `TASK-021`,`TASK-022`,`TASK-023`,`TASK-024`,`TASK-025`,`TASK-026`,`TASK-027` |
| `6` | Backoffice Base | `Sprint 06` | Entregar gestão operacional inicial no `web-backoffice`. | `TASK-028`,`TASK-029`,`TASK-030` |
| `7` | Operação | `Sprint 07` | Concluir operação de check-in, reembolso e reenvio de ingresso com testes E2E. | `TASK-031`,`TASK-032`,`TASK-060`,`TASK-054`,`TASK-055` |
| `8` | Observabilidade | `Sprint 08` | Ativar telemetria, alertas, dashboard e playbook de incidente. | `TASK-036`,`TASK-037`,`TASK-038`,`TASK-056`,`TASK-057` |

## Regras de Planejamento
- A ordem dos sprints deve respeitar as dependências listadas no backlog de tasks.
- Abertura de task em sprint posterior só é permitida se não violar dependências técnicas.
- Tasks críticas de `US-013`, `US-014` e `US-015` devem estar concluídas antes de liberar produção.

## Regras de Atualização
- Toda task deve ter status atualizado no mínimo uma vez por semana.
- Toda mudança para `CONCLUIDA` deve indicar evidência (PR, teste, deploy ou ata de validação).
- Task `BLOQUEADA` deve ter impedimento descrito no comentário da ferramenta de gestão adotada.

## Riscos e Limitações
- Backlog inicial pode exigir fatiamento adicional conforme capacidade do time.
- Dependências externas podem deslocar tasks críticas de infraestrutura e integração.

## Changelog
- `v1.20.0` - 2026-02-15 - `TASK-018` atualizada para `CONCLUIDA`: snapshot financeiro já implementado no pedido com `ticketSubtotalCents`, `serviceFeeCents`, `totalAmountCents` e `commercialPolicyVersion` persistidos no `Order` a partir da política ativa no momento da criação.
- `v1.19.0` - 2026-02-15 - Hardening Sprint 03: `TASK-016` corrigida com `TenantProvisioningInterceptor` global que garante política default automaticamente na primeira requisição autenticada de cada tenant (cache em memória); `TASK-015` fortalecida com 20 testes unitários do `TenantRbacGuard` cobrindo autenticação, controle de roles, isolamento de tenant (acesso cruzado bloqueado) e bypass de `platform_admin`.
- `v1.18.0` - 2026-02-14 - Sprint 03 concluída no backend com `TASK-015` (RBAC por tenant com claims JWT), `TASK-016` (default `platform_default_v1` automático), `TASK-017` (versionamento de política por tenant), `TASK-058` (endpoint de consulta de política ativa/default) e `TASK-035` (logs estruturados com `trace_id`).
- `v1.17.0` - 2026-02-14 - `TASK-010` concluída com endpoint `POST /v1/orders/{order_id}/payments`, idempotência por `Idempotency-Key`, persistência de `Payment` e atualização transacional de `Order/Hold/SessionSeat` para cenários aprovado/negado.
- `v1.16.0` - 2026-02-14 - `TASK-009` concluída com endpoint `POST /v1/orders`, validação de `Idempotency-Key`, conversão de `hold` em pedido `pending_payment` e persistência de itens financeiros.
- `v1.15.0` - 2026-02-14 - `TASK-008` concluída com endpoint público de hold, expiração síncrona de TTL (10 min) e liberação automática de assentos expirados.
- `v1.14.0` - 2026-02-14 - `TASK-007` concluída com `SessionSeat` por sessão, unicidade por `setor+fileira+número` e endpoint público `/v1/sessions/{session_id}/seats`.
- `v1.13.0` - 2026-02-14 - Hardening adicional da `TASK-042`: padrão automático de segurança para novas tabelas no Supabase validado em ambiente provisionado.
- `v1.12.0` - 2026-02-14 - `TASK-006` concluída com módulo de catálogo no backend (CRUD de `Event`, `EventDay` e `Session`) e validações de escopo/data.
- `v1.11.0` - 2026-02-14 - Evidência operacional de `TASK-045` registrada com smoke test aprovado no backend em produção.
- `v1.10.0` - 2026-02-14 - Task `TASK-042` concluída com baseline aplicado e validação de ACL/grants no Supabase de produção.
- `v1.9.0` - 2026-02-14 - Task `TASK-045` concluída com script de smoke test; `TASK-042` movida para `EM_ANDAMENTO` com baseline SQL versionado.
- `v1.8.0` - 2026-02-14 - Task `TASK-041` concluída com Supabase provisionado.
- `v1.7.0` - 2026-02-14 - Ajuste das tasks de autenticação para integração com Supabase Auth.
- `v1.6.0` - 2026-02-14 - Refinamento das tasks de banco para PostgreSQL gerenciado no Supabase.
- `v1.5.0` - 2026-02-14 - Backlog de deploy/infra migrado de Azure para Vercel, com atualização de status das tasks já concluídas no backend.
- `v1.4.0` - 2026-02-14 - Fase 1 finalizada com deploy Vercel validado para `web-customer` e `web-backoffice`.
- `v1.3.0` - 2026-02-14 - Ajuste da estratégia de deploy frontend para Vercel nativa, sem workflows de deploy no GitHub Actions.
- `v1.2.0` - 2026-02-14 - Atualização de status da Fase 1 com fundação concluída e deploy frontend em andamento.
- `v1.1.0` - 2026-02-14 - Inclusão do sequenciamento por fases e sprints com ordem de execução.
- `v1.0.0` - 2026-02-14 - Primeira versão do backlog de implementação com coluna de status.

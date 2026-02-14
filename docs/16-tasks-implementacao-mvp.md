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
| `TASK-006` | `US-006` | Backend | Criar módulo de eventos (`Event`, `EventDay`, `Session`). | CRUD básico funcional com validações. | `TASK-001` | `TODO` |
| `TASK-007` | `US-007` | Backend | Criar módulo de mapa de assentos por sessão. | Assentos criados com unicidade por `setor+fileira+número`. | `TASK-006` | `TODO` |
| `TASK-008` | `US-002` | Backend | Implementar hold de assento com TTL de 10 minutos. | Hold criado e expirado corretamente. | `TASK-007` | `TODO` |
| `TASK-009` | `US-003` | Backend | Implementar criação de pedido com idempotência. | Pedido não duplica com mesma chave idempotente. | `TASK-008` | `TODO` |
| `TASK-010` | `US-003` | Backend | Integrar gateway de pagamento (criação e confirmação). | Fluxo de pagamento aprovado/negado funcional. | `TASK-009` | `TODO` |
| `TASK-011` | `US-003` | Backend | Implementar webhook idempotente do gateway. | Eventos duplicados não geram inconsistência. | `TASK-010` | `TODO` |
| `TASK-012` | `US-004` | Backend | Implementar emissão de ticket QR após pagamento aprovado. | Ticket `valid` criado somente após pagamento confirmado. | `TASK-010` | `TODO` |
| `TASK-013` | `US-004` | Backend | Criar endpoint de consulta de tickets por pedido. | Buyer acessa apenas tickets permitidos por escopo. | `TASK-012` | `TODO` |
| `TASK-014` | `US-005` | Backend | Implementar endpoint de validação de QR de check-in. | Ticket usado uma vez; segundo uso negado. | `TASK-012` | `TODO` |
| `TASK-015` | `US-011` | Backend | Implementar RBAC por tenant em endpoints críticos. | Acesso cruzado bloqueado em testes de integração. | `TASK-006` | `TODO` |
| `TASK-016` | `US-010` | Backend | Implementar política comercial default `platform_default_v1`. | Tenant novo recebe política default automaticamente. | `TASK-001` | `TODO` |
| `TASK-017` | `US-010` | Backend | Versionar política comercial por tenant. | Alteração salva com `version` e `effective_from`. | `TASK-016` | `TODO` |
| `TASK-018` | `US-010` | Backend | Registrar snapshot financeiro no pedido. | Pedido persiste valores + versão da política aplicada. | `TASK-009`,`TASK-017` | `TODO` |
| `TASK-019` | `US-009` | Backend | Implementar reembolso manual com `reason_code`. | Reembolso respeita matriz e atualiza estados. | `TASK-011`,`TASK-018` | `TODO` |
| `TASK-020` | `US-009` | Backend | Auditar ações de reembolso e check-in. | Auditoria registra ator, timestamp e ação. | `TASK-014`,`TASK-019` | `TODO` |
| `TASK-021` | `US-001` | Frontend Customer | Criar home/listagem de eventos no `web-customer`. | Listagem de sessões públicas funcional. | `TASK-002`,`TASK-006` | `TODO` |
| `TASK-022` | `US-001` | Frontend Customer | Criar página de detalhe de sessão com disponibilidade. | Usuário visualiza preço e disponibilidade atual. | `TASK-021`,`TASK-007` | `TODO` |
| `TASK-023` | `US-002` | Frontend Customer | Implementar seleção de assentos e criação de hold. | Hold gerado com tratamento de conflito/expiração. | `TASK-022`,`TASK-008` | `TODO` |
| `TASK-024` | `US-003` | Frontend Customer | Implementar checkout e pagamento. | Compra finaliza com status consistente do pedido. | `TASK-023`,`TASK-010` | `TODO` |
| `TASK-025` | `US-004` | Frontend Customer | Criar área de pedidos e ingressos do comprador. | Buyer visualiza ticket QR no portal. | `TASK-013`,`TASK-024` | `TODO` |
| `TASK-026` | `US-012` | Frontend | Implementar sessão por cookie `HttpOnly`. | Login mantém sessão e renovação via backend. | `TASK-015` | `TODO` |
| `TASK-027` | `US-012` | Frontend | Implementar logout e invalidação de sessão. | Sessão removida no cliente e backend. | `TASK-026` | `TODO` |
| `TASK-028` | `US-006` | Frontend Backoffice | Criar CRUD de eventos/dias/sessões no backoffice. | Organizer Admin publica sessão com sucesso. | `TASK-003`,`TASK-006` | `TODO` |
| `TASK-029` | `US-007` | Frontend Backoffice | Criar tela de configuração de assentos por sessão. | Assentos criados/bloqueados com validação visual. | `TASK-028`,`TASK-007` | `TODO` |
| `TASK-030` | `US-008` | Frontend Backoffice | Criar tela de consulta de pedidos/pagamentos/ingressos. | Filtros por status/evento/sessão funcionam. | `TASK-003`,`TASK-013` | `TODO` |
| `TASK-031` | `US-005` | Frontend Backoffice | Criar tela operacional de check-in por QR. | Operador valida ingresso e vê resultado em tempo real. | `TASK-014`,`TASK-026` | `TODO` |
| `TASK-032` | `US-009` | Frontend Backoffice | Criar fluxo de reembolso manual. | Organizer Admin solicita reembolso com motivo obrigatório. | `TASK-019`,`TASK-026` | `TODO` |
| `TASK-033` | `US-014` | Frontend Shared | Criar base de componentes `shadcn/ui` em `packages/shared`. | Componentes reutilizados pelas duas apps frontend. | `TASK-004` | `CONCLUIDA` |
| `TASK-034` | `US-014` | Frontend Shared | Criar tokens e tema visual compartilhados. | Tema aplicado de forma consistente em ambas as apps. | `TASK-033` | `CONCLUIDA` |
| `TASK-035` | `US-015` | Backend | Instrumentar logs estruturados com `trace_id`. | Logs possuem correlação de requisição ponta a ponta. | `TASK-001` | `TODO` |
| `TASK-036` | `US-015` | Infra | Configurar Application Insights no backend Azure. | Telemetria de requisições e erros visível no portal Azure. | `TASK-050` | `TODO` |
| `TASK-037` | `US-015` | Infra | Configurar Log Analytics e consultas base. | Queries operacionais disponíveis para suporte. | `TASK-036` | `TODO` |
| `TASK-038` | `US-015` | Infra | Criar alertas de erro e latência. | Alertas ativos para 5xx e degradação p95. | `TASK-036`,`TASK-037` | `TODO` |
| `TASK-039` | `US-013` | Infra | Criar ACR no Azure. | Registry provisionado e acessível pelo pipeline. | - | `TODO` |
| `TASK-040` | `US-013` | Infra | Criar App Service Plan `S1` + App Service + slot `staging`. | Ambiente backend provisionado com slot funcional. | `TASK-039` | `TODO` |
| `TASK-041` | `US-013` | Infra | Provisionar PostgreSQL Flexible Server 18. | Banco criado com SSL obrigatório. | - | `TODO` |
| `TASK-042` | `US-013` | Infra | Configurar firewall restrito no PostgreSQL. | Apenas IPs permitidos acessam o banco. | `TASK-041`,`TASK-040` | `TODO` |
| `TASK-043` | `US-013` | CI/CD | Criar workflow GitHub Actions de build Docker backend. | Imagem publicada no ACR em push da branch principal. | `TASK-039` | `TODO` |
| `TASK-044` | `US-013` | CI/CD | Criar workflow de deploy para slot `staging`. | Deploy automático no staging após build. | `TASK-040`,`TASK-043` | `TODO` |
| `TASK-045` | `US-013` | CI/CD | Adicionar smoke test antes do swap. | Pipeline bloqueia swap se smoke test falhar. | `TASK-044` | `TODO` |
| `TASK-046` | `US-013` | Operação | Documentar procedimento de swap para produção. | Runbook de deploy validado em simulação. | `TASK-045` | `TODO` |
| `TASK-047` | `US-013` | Operação | Documentar rollback por swap reverso manual. | Rollback testado e registrado em checklist. | `TASK-046` | `TODO` |
| `TASK-048` | `US-014` | Deploy Frontend | Configurar projeto Vercel do `web-customer` com integração nativa do repositório. | Deploy automático via Vercel em push da branch principal funcional. | `TASK-002` | `EM_ANDAMENTO` |
| `TASK-049` | `US-014` | Deploy Frontend | Configurar projeto Vercel do `web-backoffice` com integração nativa do repositório. | Deploy automático via Vercel em push da branch principal funcional. | `TASK-003` | `EM_ANDAMENTO` |
| `TASK-050` | `US-013` | Segurança | Configurar OIDC GitHub -> Azure com RBAC mínimo. | Pipeline sem secret estático para deploy no Azure. | `TASK-039`,`TASK-040` | `TODO` |
| `TASK-051` | `US-015` | Qualidade | Criar testes de arquitetura para bloquear import cruzado. | Teste automatizado falha em import proibido. | `TASK-005` | `CONCLUIDA` |
| `TASK-052` | `US-003` | Qualidade | Criar testes de integração de idempotência de pagamento. | Cenários duplicados não quebram consistência. | `TASK-010`,`TASK-011` | `TODO` |
| `TASK-053` | `US-002` | Qualidade | Criar testes de concorrência de assentos. | Sem overbooking em cenários concorrentes críticos. | `TASK-008` | `TODO` |
| `TASK-054` | `US-005` | Qualidade | Criar E2E de check-in com duplo uso de QR. | Primeiro uso aprovado; segundo uso negado. | `TASK-031` | `TODO` |
| `TASK-055` | `US-009` | Qualidade | Criar E2E de reembolso manual com validação de política. | Reembolso permitido/negado conforme matriz de regras. | `TASK-032` | `TODO` |
| `TASK-056` | `US-015` | Operação | Criar dashboard operacional inicial (erro, latência, disponibilidade). | Dashboard publicado e revisado com operação. | `TASK-038` | `TODO` |
| `TASK-057` | `US-015` | Operação | Criar playbook de incidente backend. | Playbook documentado e validado pelo time. | `TASK-056` | `TODO` |
| `TASK-058` | `US-010` | Backend | Criar endpoint de consulta de política comercial por tenant. | Endpoint retorna política ativa/default com versão. | `TASK-017` | `TODO` |
| `TASK-059` | `US-004` | Backend | Garantir envio de e-mail transacional síncrono com fallback manual. | Falhas registradas e reenvio manual possível no backoffice. | `TASK-012` | `TODO` |
| `TASK-060` | `US-008` | Frontend Backoffice | Criar tela para reenvio manual de e-mail de ingresso. | Operador executa reenvio e registra auditoria da ação. | `TASK-059`,`TASK-030` | `TODO` |

## Sequenciamento por Fases e Sprints
Cadência sugerida: sprints de 2 semanas.

| Ordem | Fase | Sprint | Objetivo | Tasks |
|---|---|---|---|---|
| `1` | Fundação | `Sprint 01` | Estruturar repositório, apps frontend e bases de compartilhamento no frontend. | `TASK-001`,`TASK-002`,`TASK-003`,`TASK-004`,`TASK-005`,`TASK-033`,`TASK-034`,`TASK-048`,`TASK-049`,`TASK-051` |
| `2` | Plataforma | `Sprint 02` | Provisionar Azure + pipeline de deploy backend com swap/rollback. | `TASK-039`,`TASK-040`,`TASK-041`,`TASK-042`,`TASK-050`,`TASK-043`,`TASK-044`,`TASK-045`,`TASK-046`,`TASK-047` |
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
- `v1.3.0` - 2026-02-14 - Ajuste da estratégia de deploy frontend para Vercel nativa, sem workflows de deploy no GitHub Actions.
- `v1.2.0` - 2026-02-14 - Atualização de status da Fase 1 com fundação concluída e deploy frontend em andamento.
- `v1.1.0` - 2026-02-14 - Inclusão do sequenciamento por fases e sprints com ordem de execução.
- `v1.0.0` - 2026-02-14 - Primeira versão do backlog de implementação com coluna de status.

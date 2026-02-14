# Documento 8 - Roadmap e Fases de Entrega

## Objetivo
Organizar a entrega do MVP em fases claras, com critérios de avanço e foco em confiabilidade operacional.

## Contexto
Roadmap planejado para 12 semanas, com piloto controlado e cadência semanal de releases.

## Decisões Fechadas
- Estratégia de lançamento: piloto com poucos organizadores.
- Horizonte: 12 semanas.
- Estrutura: 4 fases.
- Cadência de deploy: semanal.
- Rollout: feature flags com liberação progressiva.
- Gate de go-live: confiabilidade operacional.
- Rollback: decisão manual.
- Governança: um owner principal por fase.

## Critérios Globais de Go-live
- Fluxo completo funcional: publicação -> venda -> pagamento -> emissão -> check-in -> reembolso manual.
- SLOs do Documento 7 instrumentados e sem violação crítica recorrente por 2 semanas.
- Zero incidente de duplicidade financeira no período de piloto.
- Política comercial (Documento 9) aplicada sem divergência em pedidos, reembolsos e conciliação.

## Fase 1 (Semanas 1-3) - Fundação
### Entregas
- Multi-tenant por subdomínio.
- JWT + RBAC.
- Cadastro de `Event`, `EventDay`, `Session`.
- Mapa de assentos e inventário por sessão.
- Setup da estrutura separada `backend/` e `frontend/`.
- Setup das aplicações frontend (`web-customer`, `web-backoffice`) em Next.js.
- Setup do backend único para API.
- Setup do pacote compartilhado exclusivo de frontend (`frontend/packages/shared`).
- Definição e adoção da stack oficial (Documento 11).

### Critérios de Aceite
- Isolamento por tenant validado.
- Publicação de sessão funcional.
- Auditoria mínima ativa para catálogo.
- Pipeline CI com lint, typecheck e testes unitários ativo nas aplicações iniciais.
- Testes de arquitetura ativos para validar fronteiras entre módulos.
- Validação automática impedindo import cruzado entre `backend/` e `frontend/`.

## Fase 2 (Semanas 4-6) - Venda e Infra de Produção
### Entregas
- Hold com TTL de 10 minutos.
- Criação de pedido e checkout.
- Integração com gateway único.
- Webhook idempotente.
- Snapshot de política comercial no pedido (taxa e versão da política).
- Provisionamento Azure backend (`App Service`, `ACR`, `PostgreSQL`, `Application Insights`).
- Pipeline de deploy em slot (`staging` -> `production`) com rollback manual.

### Critérios de Aceite
- Fluxo `Hold -> Order -> Payment` estável.
- Zero duplicidade financeira em cenários de teste.
- Expiração consistente de hold e pedido (`expired`).
- Cálculo de total do comprador e composição de taxa aderentes à política ativa do tenant.
- Deploy backend concluído com smoke test e swap por slot.

## Fase 3 (Semanas 7-9) - Operação de Evento
### Entregas
- Emissão de ticket QR.
- E-mail transacional.
- Check-in online com bloqueio de reuso.
- Reembolso manual auditável.
- Aplicação da matriz de reembolso por janela e motivo.

### Critérios de Aceite
- Ticket emitido e disponível no portal.
- Check-in dentro dos SLOs definidos.
- Reembolso atualiza estados financeiros e do ticket.
- Reembolso respeita regra comercial por motivo (`BUYER_REQUEST`, `EVENT_CANCELLED`, `EVENT_RESCHEDULED`, `OPERATIONAL_EXCEPTION`).

## Fase 4 (Semanas 10-12) - Piloto e Estabilização
### Entregas
- Observabilidade completa do baseline.
- Hardening de segurança e LGPD operacional.
- Onboarding de organizadores piloto.
- Playbooks de suporte e incidentes.

### Critérios de Aceite
- SLOs monitorados em dashboard.
- Operação piloto sem falhas críticas recorrentes.
- Checklist de produção aprovado.

## Regras de Avanço Entre Fases
- Checklist objetivo da fase concluído.
- Métricas mínimas da fase atendidas.
- Riscos remanescentes com mitigação registrada.
- Aprovação do owner principal da fase.

## Política de Rollout e Rollback
- Rollout progressivo por feature flag e por conjunto de tenants piloto.
- Rollback decidido manualmente pelo owner da fase com suporte de engenharia e operação.
- Toda decisão de rollback deve ser registrada com causa, impacto e ação corretiva.

## Riscos e Mitigações
- Concorrência de assentos: testes de carga e validação transacional.
- Instabilidade do gateway: idempotência e conciliação.
- Falha de entrega de e-mail: fallback no portal.
- Erro operacional em check-in: treinamento e auditoria.

## Critérios de Sucesso do Roadmap
- MVP operando em piloto com fluxo completo.
- Confiabilidade operacional comprovada antes de ampliação de escala.

## Changelog
- `v2.0.0` - 2026-02-14 - Alinhamento com backend síncrono e fase dedicada para deploy Azure do backend.
- `v1.5.0` - 2026-02-14 - Ajuste de entregáveis para backend único e duas aplicações frontend Next.js com pacote compartilhado exclusivo.
- `v1.4.0` - 2026-02-14 - Inclusão explícita de outbox/DLQ e testes de arquitetura no roadmap.
- `v1.3.0` - 2026-02-14 - Inclusão de entregáveis técnicos (stack, apps e CI) na Fase 1.
- `v1.2.0` - 2026-02-14 - Inclusão dos critérios de política comercial nas fases de venda, operação e go-live.
- `v1.1.0` - 2026-02-14 - Critérios globais de go-live, ajuste fino de fases e política de rollout/rollback.
- `v1.0.0` - 2026-02-14 - Versão inicial.

# Documento 9 - Políticas Comerciais e Financeiras

## Objetivo
Definir regras comerciais do MVP para taxas, reembolso, cancelamento e repasse, reduzindo ambiguidade operacional e financeira.

## Contexto
No MVP, a plataforma opera com um gateway de pagamento e repasse manual para organizadores. As regras abaixo devem ser aplicadas de forma versionada por tenant.

## Decisões Fechadas
- Política comercial versionada por `tenant`.
- Snapshot da política aplicado no pedido no momento da compra.
- Moeda padrão: BRL.
- Fuso horário padrão de política: `America/Sao_Paulo`.
- Arredondamento monetário: 2 casas decimais, regra half-up.
- Reembolso manual no MVP, com motivo padronizado e janela temporal definida.
- Repasse manual com conciliação e data de corte.

## Componentes da Política Comercial
- `service_fee_percent`: percentual de taxa de serviço ao comprador.
- `service_fee_fixed`: valor fixo por pedido.
- `refund_matrix`: regras por motivo e janela temporal.
- `payout_policy`: regras de elegibilidade e corte de repasse.
- `effective_from`: início de vigência da versão.

## Baseline Padrão por Tenant (v1)
Aplicado automaticamente para novos tenants até publicação de política customizada.

| Parâmetro | Valor default |
|---|---|
| Moeda | `BRL` |
| Fuso horário | `America/Sao_Paulo` |
| `service_fee_percent` | `10,0%` |
| `service_fee_fixed` | `R$ 2,00` por pedido |
| Janela de arrependimento (`BUYER_REQUEST`) | 7 dias da compra e antes da sessão |
| Reembolso `EVENT_CANCELLED` | 100% de `total_amount` |
| Reembolso `EVENT_RESCHEDULED` | 100% de `total_amount` até 7 dias após comunicação |
| Ciclo de repasse | Semanal |
| Corte de repasse | Segunda-feira, 23:59 (BRT) |
| Liquidação de repasse | Até D+7 corridos após corte |
| Saldo mínimo para transferência | `R$ 100,00` |

## Regras de Ativação de Política
- Tenant novo nasce com política padrão `platform_default_v1`.
- Política customizada só afeta pedidos criados após `effective_from`.
- Pedido já criado nunca recalcula taxa por troca de política.
- Se política customizada for desativada, tenant volta para `platform_default_v1`.

## Regra de Precificação e Taxas
- Preço do ingresso é definido pelo organizador por sessão.
- Taxa de serviço é configurada por tenant e cobrada do comprador.
- Faixas operacionais recomendadas para MVP:
  - `service_fee_percent`: de `0%` a `25%`.
  - `service_fee_fixed`: de `R$ 0,00` a `R$ 10,00`.
- A taxa aplicada deve ser congelada no pedido (`OrderFinancialSnapshot`).

## Fórmulas Financeiras (MVP)
- `ticket_subtotal = soma(preço_unitário * quantidade)`
- `service_fee = round_half_up(ticket_subtotal * service_fee_percent + service_fee_fixed, 2)`
- `total_amount = ticket_subtotal + service_fee`
- `organizer_gross = ticket_subtotal`
- `organizer_net = organizer_gross - gateway_fee - refunds - chargebacks`
- `platform_revenue = service_fee`

## Matriz de Reembolso (MVP)
### Motivo `BUYER_REQUEST` (cancelamento pelo comprador)
- Dentro de 7 dias da compra e antes do início da sessão: 100% do valor pago.
- Fora da regra acima:
  - `>= 168h` antes da sessão: até 90% do `ticket_subtotal`.
  - `< 168h` e `>= 48h` antes da sessão: até 70% do `ticket_subtotal`.
  - `< 48h` antes da sessão: sem reembolso.

### Motivo `EVENT_CANCELLED`
- Reembolso de 100% do valor pago (`total_amount`).

### Motivo `EVENT_RESCHEDULED`
- Reembolso de 100% do valor pago (`total_amount`) se solicitado até 7 dias após comunicação oficial e antes da nova sessão.

### Motivo `OPERATIONAL_EXCEPTION`
- Regra manual aprovada por `platform_admin`, com justificativa obrigatória em auditoria.

## Impacto do Reembolso no Ingresso
- Reembolso por cancelamento do comprador (`BUYER_REQUEST`) cancela o ticket.
- Reembolso por evento cancelado (`EVENT_CANCELLED`) cancela o ticket.
- Reembolso por evento remarcado (`EVENT_RESCHEDULED`) cancela o ticket quando o comprador opta por não participar.
- Exceções operacionais (`OPERATIONAL_EXCEPTION`) devem explicitar no registro se o ticket permanece válido ou é cancelado.

## Regras de Repasse (MVP)
- Repasse manual com ciclo semanal.
- Elegível para repasse:
  - Pedido em `paid`.
  - Sem reembolso pendente.
  - Sem chargeback pendente.
  - Sessão encerrada.
- Data de corte operacional: segunda-feira, 23:59 (BRT).
- Pagamento do lote de repasse: até D+7 corridos após a data de corte.
- Saldo mínimo para transferência: `R$ 100,00` (valores menores acumulam para o próximo ciclo).

## Regras de Chargeback
- Chargeback aberto bloqueia valor correspondente do próximo repasse do tenant.
- Se não houver saldo suficiente, registra saldo devedor para compensação futura.
- Ticket com check-in aprovado exige tratamento de disputa em trilha de auditoria.

## Governança de Política
- Alteração de política apenas por `platform_admin`.
- Mudanças não retroagem pedidos já criados.
- Toda alteração exige:
  - nova `version`;
  - `effective_from`;
  - justificativa registrada em `AuditEvent`.

## Regras e Critérios de Aceite
- Todo pedido registra snapshot financeiro com versão da política.
- Reembolso só é concluído se aderente à matriz de motivo e janela.
- Conciliação e repasse devem ser reproduzíveis por relatório financeiro.
- Divergência entre cálculo esperado e realizado deve ser 0 no conjunto de testes de regressão financeira.

## Riscos e Limitações
- Reembolso manual pode aumentar carga operacional em picos.
- Chargebacks tardios podem gerar variação de caixa por tenant.
- Ausência de repasse automático exige disciplina de operação financeira.

## Changelog
- `v1.2.0` - 2026-02-14 - Definição de baseline default por tenant e regras de ativação de política.
- `v1.1.0` - 2026-02-14 - Clarificação do impacto de reembolso sobre o status do ticket.
- `v1.0.0` - 2026-02-14 - Versão inicial das políticas comerciais e financeiras.

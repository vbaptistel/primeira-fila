# Documento 7 - NFRs e SLOs

## Objetivo
Definir requisitos não funcionais e metas de operação para garantir confiabilidade do MVP.

## Contexto
A plataforma precisa suportar venda e check-in com desempenho consistente e segurança adequada ao contexto de eventos presenciais.

## Decisões Fechadas
- Disponibilidade mensal alvo: `99.5%`.
- Latência p95 de API síncrona: `<= 400ms`.
- Latência p95 de validação de QR: `<= 300ms`.
- Throughput de referência: `500 req/s` leitura e `80 req/s` escrita.
- Sucesso técnico de pagamentos: `>= 99.0%`.
- Duplicidade financeira por falha de idempotência: `0 incidentes`.
- Divergência máxima na conciliação financeira diária: `<= 0,1%` do volume bruto diário.
- DR: `RTO 2h`, `RPO 15min`.
- Retenção: `90 dias` logs técnicos e `1 ano` auditoria.
- SLA interno para resposta inicial LGPD: `até 7 dias corridos`.

## SLOs Operacionais
| Categoria | Meta | Janela |
|---|---|---|
| Disponibilidade mensal | `99.5%` | Mensal |
| API p95 (sync) | `<= 400ms` | 5 min |
| Check-in p95 | `<= 300ms` | 5 min |
| Pagamento técnico | `>= 99.0%` | Diário |
| Idempotência financeira | `0 incidentes` | Mensal |
| Divergência de conciliação | `<= 0,1%` | Diário |

## Definições de SLI
- Disponibilidade: `requisições 2xx/3xx válidas / requisições totais` (excluindo janelas de manutenção programada).
- Pagamento técnico: `transações processadas sem erro técnico / transações totais` (exclui recusas do emissor).
- Latência API/Check-in: percentil 95 das requisições concluídas.

## Capacidade e Concorrência
- Suportar picos de leitura e escrita conforme alvo.
- Prevenir overbooking em todas as sessões.
- Hold expira e libera inventário automaticamente.
- Operações de fechamento usam verificação transacional.

## Segurança
- Autenticação via JWT.
- RBAC por papel e escopo de tenant.
- TLS em trânsito.
- Criptografia de dados sensíveis em repouso.
- Segredos fora de código com rotação periódica.

## LGPD e Governança
- Processo formal para solicitações do titular.
- Minimização de dados pessoais.
- Trilha de auditoria para eventos críticos.
- Resposta inicial LGPD em até 7 dias corridos.

## Observabilidade
- Logs estruturados com `trace_id`.
- Métricas de API, checkout, pagamento, emissão e check-in.
- Tracing básico entre módulos internos e integrações externas.
- Alertas para falhas críticas e degradação de latência.

## Alertas Operacionais de Referência
- API p95 acima de `400ms` por 10 min.
- Check-in p95 acima de `300ms` por 10 min.
- Taxa de erro 5xx acima de `1%` por 5 min.
- Falha de webhook ou fila acumulada acima do limite operacional definido.

## Continuidade de Negócio
- `RTO 2h`: recuperar serviço em até 2 horas.
- `RPO 15min`: perda máxima aceitável de 15 minutos de dados.
- Procedimento de restauração documentado e testado.

## Regras e Critérios de Aceite
- SLOs instrumentados em dashboards.
- Alertas operacionais ativos para violações relevantes.
- Evidência de testes de carga e de resiliência.
- Execução de simulação de recuperação com resultado registrado.

## Riscos e Limitações
- Metas de latência podem variar em picos extremos.
- Integrações externas podem impactar SLO sem controle total interno.

## Changelog
- `v1.2.0` - 2026-02-14 - Inclusão de meta de conciliação financeira diária.
- `v1.1.0` - 2026-02-14 - Inclusão de SLI formais e alertas de referência.
- `v1.0.0` - 2026-02-14 - Versão inicial.

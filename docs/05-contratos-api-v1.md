# Documento 5 - Contratos de API v1

## Objetivo
Documentar contratos públicos da API do MVP para implementação e integração consistentes.

## Contexto
API REST/JSON sob `/v1`, com escopo multi-tenant e foco em operações de venda, emissão, check-in e reembolso.

## Decisões Fechadas
- Versionamento por prefixo de URL: `/v1`.
- Paginação cursor-based.
- Erro padrão com `code`, `message`, `details`, `trace_id`.
- Idempotência obrigatória em pedido, pagamento e reembolso.
- Webhook com validação por assinatura HMAC + timestamp.

## Convenções Globais
- Base path: `/v1`
- Formato: `application/json`
- Header de autenticação: `Authorization: Bearer <supabase_access_token>`
- Header de correlação: `X-Request-Id` (opcional, recomendado)
- Header de idempotência quando obrigatório: `Idempotency-Key: <uuid>`
- Paginação:
  - Request: `?cursor=<token>&limit=<n>`
  - `limit` padrão: `20`, máximo: `100`
  - Response: `next_cursor`

## Contrato Padrão de Erro
```json
{
  "code": "INVENTORY_UNAVAILABLE",
  "message": "Requested seat is not available",
  "details": {
    "session_id": "ses_123",
    "seat": "A-10"
  },
  "trace_id": "trc_abc123"
}
```

## Semântica de Idempotência
- Mesma `Idempotency-Key` + mesmo payload: retorna o resultado originalmente persistido.
- Mesma `Idempotency-Key` + payload diferente: retorna `409 CONFLICT`.
- Janela mínima de retenção da chave: 24h.

## Autenticação e Autorização
- Supabase Auth como provider de identidade.
- JWT do Supabase Auth para usuários autenticados.
- Fluxos de login, refresh e logout realizados pelo provider (SDK), fora da API de domínio.
- Escopo por tenant em todas as operações de organizador e operador.
- RBAC:
  - `platform_admin`: escopo global.
  - `organizer_admin`: escopo do próprio tenant.
  - `operator`: check-in e consulta operacional do tenant.
  - `buyer`: seus pedidos e ingressos.

## Endpoints Principais
| Método | Endpoint | Auth | Papel mínimo |
|---|---|---|---|
| GET | `/v1/me` | Sim | Qualquer autenticado |
| GET | `/v1/tenants/{tenant_id}/commercial-policy` | Sim | Organizer/Admin |
| GET | `/v1/tenants/{tenant_id}/events` | Sim | Organizer/Admin |
| POST | `/v1/tenants/{tenant_id}/events` | Sim | Organizer/Admin |
| GET | `/v1/tenants/{tenant_id}/events/{event_id}` | Sim | Organizer/Admin |
| PATCH | `/v1/tenants/{tenant_id}/events/{event_id}` | Sim | Organizer/Admin |
| DELETE | `/v1/tenants/{tenant_id}/events/{event_id}` | Sim | Organizer/Admin |
| GET | `/v1/events` | Não | Público |
| GET | `/v1/events/{event_id}` | Não | Público |
| GET | `/v1/sessions/{session_id}/seats` | Não | Público |
| POST | `/v1/sessions/{session_id}/holds` | Não | Público |
| POST | `/v1/orders` | Não | Público |
| GET | `/v1/orders/{order_id}` | Sim | Buyer/Admin do escopo |
| POST | `/v1/orders/{order_id}/payments` | Não | Público |
| POST | `/v1/payments/webhooks/{provider}` | Não | Gateway |
| GET | `/v1/orders/{order_id}/tickets` | Sim | Buyer/Admin do escopo |
| POST | `/v1/checkins/validate-qr` | Sim | Operator/Admin |
| POST | `/v1/orders/{order_id}/refunds` | Sim | Organizer/Admin |

### Endpoints de Catálogo (Organizer/Admin)
- `EventDay`:
  - `POST /v1/tenants/{tenant_id}/events/{event_id}/days`
  - `GET /v1/tenants/{tenant_id}/events/{event_id}/days`
  - `GET /v1/tenants/{tenant_id}/events/{event_id}/days/{event_day_id}`
  - `PATCH /v1/tenants/{tenant_id}/events/{event_id}/days/{event_day_id}`
  - `DELETE /v1/tenants/{tenant_id}/events/{event_id}/days/{event_day_id}`
- `Session`:
  - `POST /v1/tenants/{tenant_id}/events/{event_id}/days/{event_day_id}/sessions`
  - `GET /v1/tenants/{tenant_id}/events/{event_id}/days/{event_day_id}/sessions`
  - `GET /v1/tenants/{tenant_id}/events/{event_id}/days/{event_day_id}/sessions/{session_id}`
  - `PATCH /v1/tenants/{tenant_id}/events/{event_id}/days/{event_day_id}/sessions/{session_id}`
  - `DELETE /v1/tenants/{tenant_id}/events/{event_id}/days/{event_day_id}/sessions/{session_id}`

## Fluxo Padrão de Checkout
1. `POST /v1/sessions/{session_id}/holds`
2. `POST /v1/orders`
3. `POST /v1/orders/{order_id}/payments`

## Regras de Estado por Endpoint Crítico
- `POST /holds`:
  - retorna `201` quando hold criado.
  - retorna `409` quando assento/quantidade indisponível.
- `POST /orders`:
  - retorna `201` quando pedido criado em `pending_payment`.
  - retorna `410` quando hold expirado.
- `POST /payments`:
  - retorna `202` para processamento pendente.
  - confirmações finais via retorno síncrono e/ou webhook.
- Timeout de pagamento após expiração do hold:
  - pedido deve ir para `expired`.
  - inventário deve retornar para `available`.

## Contratos Críticos (Resumo)
### Consultar Política Comercial
`GET /v1/tenants/{tenant_id}/commercial-policy`
- Retorna versão ativa, regras de taxas, janelas de reembolso e parâmetros de repasse.
- Quando não houver política customizada ativa, retorna `platform_default_v1` com `is_platform_default=true`.
- Uso principal: backoffice e auditoria operacional.

### Criar Hold
`POST /v1/sessions/{session_id}/holds`
- Entrada: assentos (`sector`, `row`, `number`) ou quantidade de quota.
- Saída: `hold_id`, `expires_at`, itens reservados.

### Criar Pedido
`POST /v1/orders`
- Idempotência: obrigatória.
- Entrada: `hold_id`, dados de comprador, resumo financeiro.
- Saída: `order_id`, `status=pending_payment`, snapshot financeiro (`ticket_subtotal`, `service_fee`, `total_amount`, `commercial_policy_version`).

### Iniciar Pagamento
`POST /v1/orders/{order_id}/payments`
- Idempotência: obrigatória.
- Entrada: método e dados do gateway.
- Saída: `payment_id`, `status`.

### Validar QR
`POST /v1/checkins/validate-qr`
- Entrada: `qr_code`, `session_id`.
- Saída: `approved` ou `denied`, motivo e timestamp.

### Solicitar Reembolso
`POST /v1/orders/{order_id}/refunds`
- Idempotência: obrigatória.
- Entrada: valor total/parcial, `reason_code`, observação opcional.
- `reason_code` suportado: `BUYER_REQUEST`, `EVENT_CANCELLED`, `EVENT_RESCHEDULED`, `OPERATIONAL_EXCEPTION`.
- Saída: estado de reembolso, impacto em ticket/pedido e referência de regra aplicada da política comercial.

## Webhook de Pagamento
`POST /v1/payments/webhooks/{provider}`
- Validar assinatura HMAC.
- Validar janela de tempo por timestamp.
- Deduplicar por `provider_event_id`.
- Responder de forma idempotente.

## Códigos de Erro Recomendados
- `AUTH_INVALID_TOKEN`
- `AUTH_FORBIDDEN`
- `TENANT_SCOPE_VIOLATION`
- `INVENTORY_UNAVAILABLE`
- `HOLD_EXPIRED`
- `ORDER_INVALID_STATE`
- `PAYMENT_DECLINED`
- `WEBHOOK_SIGNATURE_INVALID`
- `CHECKIN_ALREADY_USED`
- `CHECKIN_TICKET_INVALID`
- `REFUND_NOT_ALLOWED`
- `REFUND_WINDOW_EXPIRED`
- `COMMERCIAL_POLICY_NOT_FOUND`
- `PAYOUT_NOT_ELIGIBLE`

## Regras e Critérios de Aceite
- Contratos cobrem todo fluxo in-scope do MVP.
- Endpoints críticos com idempotência e erros padronizados.
- Regras RBAC e tenant scope explícitas por endpoint.
- Endpoint de política comercial deve retornar defaults operacionais para tenant sem customização.

## Riscos e Limitações
- Mudanças de gateway podem demandar extensão de payloads.
- Evolução para multi-gateway exigirá contrato adicional de roteamento.

## Changelog
- `v1.5.0` - 2026-02-14 - Inclusão dos endpoints de catálogo de organizador (`Event`, `EventDay`, `Session`) no contrato v1.
- `v1.4.0` - 2026-02-14 - Alinhamento de autenticação para Supabase Auth como provider de identidade.
- `v1.3.0` - 2026-02-14 - Regra explícita de fallback para política default (`platform_default_v1`).
- `v1.2.0` - 2026-02-14 - Inclusão de contrato de política comercial e campos financeiros de snapshot em pedido/reembolso.
- `v1.1.0` - 2026-02-14 - Semântica de idempotência, paginação e regras finas de estado HTTP.
- `v1.0.0` - 2026-02-14 - Versão inicial.

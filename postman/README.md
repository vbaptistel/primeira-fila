# Postman Collection – Primeira Fila API

Collection e environment para testar as APIs do backend Primeira Fila.

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `primeira-fila-api.postman_collection.json` | Collection com todas as requisições |
| `primeira-fila.postman_environment.json` | Variáveis de ambiente |

## Como importar

1. Abra o Postman.
2. **Collection:** File → Import → escolha `primeira-fila-api.postman_collection.json`.
3. **Environment:** File → Import → escolha `primeira-fila.postman_environment.json`.
4. Selecione o environment "Primeira Fila" no seletor de environment (canto superior direito).

## Obter o JWT

As rotas autenticadas exigem um token JWT do Supabase Auth.

1. Faça login no frontend (web-backoffice ou web-customer) via Supabase.
2. No DevTools do navegador (Application → Local Storage ou Session Storage), procure a chave do Supabase.
3. Ou use a API do Supabase diretamente:
   - `POST {{SUPABASE_URL}}/auth/v1/token?grant_type=password` com `email` e `password`.
4. Copie o `access_token` da resposta e cole em `jwtToken` no environment.

## Variáveis de ambiente

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `baseUrl` | URL base da API | `http://localhost:3001` |
| `jwtToken` | Token JWT para rotas autenticadas | (cole após login) |
| `tenantId` | UUID do tenant | (preencha após criar tenant) |
| `eventId` | UUID do evento | (preencha após criar evento) |
| `eventDayId` | UUID do dia do evento | (preencha após criar dia) |
| `sessionId` | UUID da sessão | (preencha após criar sessão) |
| `seatId` | UUID do assento | (preencha após criar assentos) |
| `holdId` | UUID do hold | (retornado por Create Hold) |
| `orderId` | UUID do pedido | (retornado por Create Order) |
| `hostForTenant` | Host para resolver tenant em rotas públicas | `acme.primeira-fila.com` |

## Ordem sugerida de uso

1. **Health Check** – conferir se o backend está rodando.
2. **Create Tenant** – criar um tenant (requer `platform_admin`).
3. Preencher `tenantId` no environment.
4. **Create Event** → **Create Event Day** → **Create Session** → **Create Session Seat(s)**.
5. Preencher `eventId`, `eventDayId`, `sessionId` e, se necessário, `seatId`.
6. **Create Hold** – reservar assentos; copiar `id` do hold para `holdId`.
7. **Create Order** – criar pedido com o `holdId`.
8. **Create Order Payment** – registrar pagamento.

## Rotas públicas e Host

Rotas como **List Public Events** e **Get Public Event** resolvem o tenant pelo header `Host` (ou `X-Forwarded-Host`). Em testes locais, use `hostForTenant` com um subdomínio existente (ex: `acme.primeira-fila.com`). Para isso funcionar localmente, você pode:

- Mapear no `/etc/hosts`: `127.0.0.1 acme.primeira-fila.com`
- Ou usar a URL de staging/produção no `baseUrl` e `hostForTenant`.

## Importar via OpenAPI

Com o backend rodando, você pode importar a spec OpenAPI no Postman:

1. No Postman: Import → Link.
2. URL: `http://localhost:3001/docs-json` (ou `{{baseUrl}}/docs-json`).
3. Escolha importar como Collection.

A collection gerada pode não incluir exemplos de body; use esta collection para exemplos completos.

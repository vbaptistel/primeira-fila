# Primeira Fila

Monorepo da plataforma de venda de ingressos.

## Estrutura

```text
backend/
frontend/
  apps/
    web-customer/
    web-backoffice/
  packages/
    shared/
docs/
```

## Requisitos

- Node.js 22+
- npm 10+

## Comandos principais

```bash
npm install
npm run lint
npm run typecheck
npm run test:arch
npm run build
```

## Desenvolvimento

```bash
npm run dev --workspace web-customer
npm run dev --workspace web-backoffice
npm run dev --workspace @primeira-fila/backend
```

## Regra de fronteira

- `backend/*` não pode importar nada de `frontend/*`.
- `frontend/*` não pode importar nada de `backend/*`.
- A validação automática está em `scripts/check-boundaries.mjs`.

## Deploy (Vercel)

Deploy via integração nativa da Vercel com o repositório (sem GitHub Actions para deploy).

Configuração esperada:

- Projeto Vercel do backend apontando para `backend/`.
- Projeto Vercel para `web-customer` apontando para `frontend/apps/web-customer`.
- Projeto Vercel para `web-backoffice` apontando para `frontend/apps/web-backoffice`.
- Deploy automático por push na branch principal via Vercel.

Smoke test pós-deploy do backend:

```bash
npm run smoke:backend -- --base-url=https://<backend-url>
```

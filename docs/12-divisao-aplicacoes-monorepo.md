# Documento 12 - Divisão de Aplicações e Monorepo

## Objetivo
Definir a organização de aplicações, pacotes compartilhados e responsabilidades no repositório.

## Contexto
A divisão foi desenhada para separar claramente backend e frontend, mantendo backend único e duas aplicações frontend com compartilhamento apenas entre si.

## Decisões Fechadas
- Estrutura em um repositório com dois domínios de código separados: `backend/` e `frontend/`.
- Backend único para API e regras de negócio.
- Frontend com duas aplicações Next.js.
- Pacote compartilhado somente entre aplicações frontend.
- Proibição de duplicar lógica de negócio entre apps.
- Proibição de compartilhamento de código-fonte entre backend e frontend.

## Estrutura de Diretórios (alvo)
```text
backend/
  src/
    modules/
    common/
  prisma/
  package.json
frontend/
  apps/
    web-customer/
    web-backoffice/
  packages/
    shared/
  package.json
docs/
```

## Aplicações e Responsabilidades
- `frontend/apps/web-customer`:
  - navegação pública de eventos;
  - checkout e consulta de pedido/ingresso do comprador.
- `frontend/apps/web-backoffice`:
  - gestão de tenant (no escopo do tenant do usuário), eventos, sessões e assentos;
  - operação de check-in, reembolso manual e gestão de usuários do tenant (Documento 18).
- Frontend dedicado à plataforma (ex.: `web-platform`) para platform_admin: **previsto para fase posterior** (Documento 18). Até lá, operações de platform_admin (listar tenants, criar tenant, criar primeiro usuário) via API ou script.
- `backend/src/modules`:
  - API REST `/v1`;
  - regras transacionais, autenticação e autorização;
  - integração com banco e provedores externos.

## Pacotes Compartilhados
- `frontend/packages/shared`:
  - componentes base de `shadcn/ui`;
  - design tokens, hooks e utilitários de frontend;
  - consumo por **web-backoffice** e pelo futuro **web-platform** (frontend dedicado à plataforma).
- `frontend/apps/web-customer` não consome o shared; possui componentes de UI próprios internalizados no app (Badge, Button, Input, Label, Separator, Skeleton e estilos associados), permitindo evoluções específicas da experiência do comprador sem impactar o backoffice.

## Regras de Dependência entre Apps e Packages
- `frontend/apps/*` podem depender de `frontend/packages/shared`; o web-customer opta por não depender (componentes internalizados).
- `backend/*` não pode importar nada de `frontend/*`.
- `frontend/*` não pode importar nada de `backend/*`.
- Integração backend/frontend ocorre exclusivamente por contratos HTTP (OpenAPI).
- Dependências circulares entre packages são proibidas.

## Ownership Técnico
- `frontend/apps/web-customer`: time de experiência do comprador.
- `frontend/apps/web-backoffice`: time de operação do organizador.
- `frontend/packages/shared`: ownership frontend com revisão cruzada.
- `backend/src/modules`: time de plataforma backend.

## Build, Teste e Deploy
- Pipeline separado para `backend` e `frontend`.
- Deploy do backend em unidade única na Vercel.
- Deploy independente das duas aplicações frontend na Vercel.

## Regras e Critérios de Aceite
- Cada responsabilidade deve estar no app correto.
- Nenhum frontend pode replicar regra de negócio que pertence ao backend.
- `frontend/packages/shared` deve ter versionamento interno e changelog.
- Deve existir validação em CI bloqueando import cruzado entre `backend/` e `frontend/`.

## Riscos e Limitações
- Sem governança de ownership, pode haver acoplamento indevido entre as duas apps frontend.
- Mudanças no pacote compartilhado de frontend podem causar regressões amplas sem testes suficientes.
- Falta de contrato OpenAPI bem versionado pode quebrar integração sem compartilhamento de código.

## Changelog
- `v2.2.0` - 2026-02-15 - Web-customer: componentes de UI internalizados (Badge, Button, Input, Label, Separator, Skeleton); remoção da dependência de `@primeira-fila/shared`. Shared permanece para web-backoffice e futuro web-platform.
- `v2.1.0` - 2026-02-15 - Web-backoffice: gestão de usuários do tenant (Doc 18). Previsão de frontend dedicado à plataforma (web-platform) para fase posterior.
- `v2.0.0` - 2026-02-14 - Ajuste para backend único em modo síncrono e estrutura final de frontend compartilhado.
- `v1.1.0` - 2026-02-14 - Separação backend/frontend com backend único e pacote compartilhado exclusivo de frontend.
- `v1.0.0` - 2026-02-14 - Definição inicial da divisão de aplicações e monorepo.

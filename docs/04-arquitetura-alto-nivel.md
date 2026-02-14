# Documento 4 - Arquitetura de Alto Nível

## Objetivo
Definir a arquitetura técnica do MVP, com fronteiras claras entre módulos e integrações externas.

## Contexto
A prioridade do MVP é velocidade de entrega com confiabilidade operacional. A escolha técnica base é monólito modular.

## Decisões Fechadas
- Estilo: monólito modular.
- Interface backend: REST/JSON.
- Assincronia seletiva para tarefas não bloqueantes (fila).
- Persistência inicial: PostgreSQL único.
- Isolamento de organizadores por `tenant_id`.
- Integrações externas obrigatórias: gateway de pagamento e e-mail transacional.

## Princípios Arquiteturais
- Consistência forte para operações financeiras e inventário.
- Idempotência obrigatória em operações críticas.
- Fail-safe em fluxos de venda: nunca vender sem inventário confirmado.
- Observabilidade desde o MVP para operação em evento real.

## Módulos Internos
- `IdentityAccess`: autenticação JWT e RBAC.
- `TenancyBranding`: resolução por subdomínio e configuração white-label.
- `Catalog`: evento, dia, sessão e mapa de assentos.
- `Inventory`: hold, expiração, bloqueio e venda.
- `CheckoutOrders`: pedido e cálculo de totais/taxas.
- `Payments`: cobrança, webhook, conciliação.
- `Ticketing`: emissão de QR e estado de ingresso.
- `CheckIn`: validação de QR e prevenção de reuso.
- `Notifications`: envio de e-mail e retentativas.
- `Backoffice`: operação de organizer admin e platform admin.
- `AuditCompliance`: trilha de auditoria e suporte a LGPD.

## Visão de Componentes
```mermaid
flowchart TD
  FE[Web Responsivo] --> API[REST API /v1]
  API --> IA[IdentityAccess]
  API --> TB[TenancyBranding]
  API --> CAT[Catalog]
  API --> INV[Inventory]
  API --> ORD[CheckoutOrders]
  API --> PAY[Payments]
  API --> TIC[Ticketing]
  API --> CHK[CheckIn]
  API --> BO[Backoffice]
  API --> AUD[AuditCompliance]
  PAY --> PG[Gateway de Pagamento]
  TIC --> Q[Queue]
  PAY --> Q
  Q --> NTF[Notifications]
  NTF --> ESP[Serviço de E-mail]
  API --> DB[(PostgreSQL)]
```

## Fluxos Transacionais Críticos
- Reserva de assento (`hold`) e criação de pedido devem ocorrer em transação consistente.
- Confirmação de pagamento e conversão de inventário para `sold` devem ser atômicas.
- Emissão de ticket deve ocorrer após confirmação de pagamento persistida.

## Assincronia e Entrega
- Fila usada para envio de e-mail e tarefas de retentativa.
- Semântica mínima: entrega ao menos uma vez com consumidores idempotentes.
- Falha de worker não pode perder evento crítico (pagamento, emissão, notificação).

## Dados e Persistência
- Banco relacional único no MVP.
- Todas as tabelas de negócio com chave de escopo por tenant.
- Listagens e busca por query relacional (sem motor dedicado neste ciclo).

## Segurança e Observabilidade
- JWT para autenticação.
- RBAC por papel: `platform_admin`, `organizer_admin`, `operator`, `buyer`.
- TLS em trânsito e criptografia de dados sensíveis em repouso.
- Logs estruturados com `trace_id`, métricas e tracing básico.

## Regras e Critérios de Aceite
- Fronteiras de módulo devem reduzir acoplamento entre domínios.
- Integrações externas devem suportar retentativa e idempotência.
- Arquitetura deve comportar piloto sem depender de microserviços.

## Riscos e Limitações
- Monólito modular requer disciplina para manter limites de domínio.
- Eventual escala alta pode exigir extração gradual de módulos.

## Changelog
- `v1.1.0` - 2026-02-14 - Regras finas de consistência transacional e assíncrona.
- `v1.0.0` - 2026-02-14 - Versão inicial.

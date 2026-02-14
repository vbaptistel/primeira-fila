# Documento 10 - Padrões de Arquitetura Técnica

## Objetivo
Definir padrões obrigatórios de arquitetura para manter consistência, evolutividade e operação confiável do produto.

## Contexto
O produto seguirá monólito modular no MVP, com separação clara de domínio e processamento interno totalmente síncrono.

## Decisões Fechadas
- Estilo: monólito modular com fronteiras internas explícitas.
- Módulos do MVP: `IdentityAccess`, `TenancyBranding`, `Catalog`, `Inventory`, `CheckoutOrders`, `Payments`, `Ticketing`, `CheckIn`, `Notifications`, `Backoffice`, `AuditCompliance`.
- Padrão interno por módulo: Clean Architecture leve (camadas de domínio, aplicação e infraestrutura).
- Integração entre módulos: contratos internos síncronos.
- Acesso entre módulos: proibido acesso direto a dados de outro módulo.
- Fronteira transacional: uma transação por caso de uso crítico.
- Mudanças arquiteturais estruturais exigem ADR.

## Padrões Obrigatórios por Módulo
- `Domain`: entidades, regras e invariantes sem dependência de framework.
- `Application`: casos de uso, orquestração transacional e contratos internos.
- `Infrastructure`: banco, integrações externas e adaptadores.
- `Interface`: controladores HTTP e serialização de contrato.

## Regras de Dependência
- `Interface` pode depender de `Application`.
- `Application` pode depender de `Domain`.
- `Infrastructure` implementa portas definidas por `Application`/`Domain`.
- `Domain` não depende de `Application`, `Interface` ou `Infrastructure`.

## Contratos Internos
### Contrato padrão de comando
`execute(input, context): Result`

### Campos mínimos de `context`
- `tenant_id`
- `actor_id`
- `trace_id`
- `idempotency_key` (obrigatório em operações críticas)

### Regras de contrato interno
- Comandos não retornam entidades de infraestrutura.
- Contratos devem ser tipados e versionados quando houver quebra.
- Alterações de contrato que impactem outro módulo exigem ADR.

## Padrões de Comunicação
- Síncrono (REST + contratos internos): fluxo principal de negócio (checkout, check-in, consulta de pedidos, emissão e reembolso).

## Padrão Transacional
- Operações críticas usam transação de banco com escopo mínimo.
- Uso obrigatório de idempotência em criação de pedido, pagamento e reembolso.
- Regra de consistência: completar persistência do estado de negócio e resposta dentro do mesmo ciclo síncrono.

## Regras de Acesso entre Módulos
- Módulo A não lê/escreve diretamente tabelas do módulo B.
- Se A depender de informação de B, deve usar contrato de consulta/comando de B.
- Exceções temporárias só com ADR aprovada e data de remoção planejada.

## Gestão de Evolução Arquitetural
- Todo desvio de padrão deve ter ADR aprovada por engenharia.
- Critérios para revisão de arquitetura:
  - gargalo comprovado de latência por operação;
  - necessidade de escalar módulo de forma isolada;
  - acoplamento impedindo evolução segura.

## ADR (Architecture Decision Record)
- Local: `docs/adr/`.
- Nomenclatura: `NNNN-titulo-curto.md`.
- Campos mínimos:
  - contexto;
  - decisão;
  - alternativas avaliadas;
  - consequências;
  - plano de migração (quando aplicável).

## Testes e Cenários Obrigatórios
- Unitário:
  - invariantes de domínio por módulo.
- Integração:
  - atomicidade transacional por caso de uso crítico;
  - idempotência em pedido, pagamento e reembolso;
  - bloqueio de acesso cruzado indevido entre módulos.
- E2E técnico:
  - compra completa com emissão e check-in;
  - reembolso manual com atualização de estados;
  - validação de RBAC por tenant.

## Regras e Critérios de Aceite
- Cada módulo deve respeitar camadas e regras de dependência.
- Não pode haver acesso cruzado não autorizado a dados de outro módulo.
- Toda decisão arquitetural relevante deve ter ADR.
- Operações críticas devem permanecer consistentes no fluxo síncrono.

## Assunções e Defaults
- Banco de dados único PostgreSQL 18 no MVP.
- Contratos internos implementados em TypeScript.
- Não haverá extração de microserviço nesta fase.

## Riscos e Limitações
- Operações externas lentas podem elevar latência no modelo síncrono.
- Integrações externas com instabilidade exigem estratégia operacional de contingência.

## Changelog
- `v2.1.0` - 2026-02-14 - Remoção de menções a processamento paralelo interno.
- `v2.0.0` - 2026-02-14 - Ajuste para arquitetura síncrona no estágio atual.
- `v1.1.0` - 2026-02-14 - Especificação executável de contratos internos e testes arquiteturais.
- `v1.0.0` - 2026-02-14 - Definição inicial dos padrões arquiteturais técnicos.

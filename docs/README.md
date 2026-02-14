# Documentação Geral - Plataforma White-label de Ingressos (MVP)

## Objetivo
Centralizar a documentação oficial do MVP para produto, engenharia e operação, com rastreabilidade de decisões e critérios de aceite mensuráveis.

## Contexto
Projeto white-label de venda de ingressos para organizadores no Brasil, com foco inicial em web responsivo, um gateway de pagamento e confiabilidade operacional.

## Sumário
1. `docs/01-visao-produto.md`
2. `docs/02-escopo-mvp.md`
3. `docs/03-modelo-dominio.md`
4. `docs/04-arquitetura-alto-nivel.md`
5. `docs/05-contratos-api-v1.md`
6. `docs/06-fluxos-usuario.md`
7. `docs/07-nfrs-slos.md`
8. `docs/08-roadmap-fases.md`
9. `docs/09-politicas-comerciais-financeiras.md`

## Convenções
- Idioma oficial: Português-BR.
- Formato: Markdown com template fixo.
- Diagramas: Mermaid quando houver ganho de clareza.
- API base: `/v1`.
- Isolamento multi-tenant: obrigatório por `tenant_id`.

## Regras de Consistência
- Domínio, APIs e fluxos devem usar os mesmos estados de negócio.
- Metas de produto (Documento 1) devem ser operacionalizadas por NFR/SLO (Documento 7).
- Critérios de fase (Documento 8) devem depender de critérios técnicos e funcionais dos documentos anteriores.
- Regras de taxas, reembolso e repasse devem seguir o Documento 9.
- Tenant sem política customizada deve operar com `platform_default_v1`.

## Fluxo de Revisão
1. Produto valida intenção, escopo e metas.
2. Engenharia valida viabilidade técnica, contratos e riscos.
3. Operação valida executabilidade em evento real.

## Critérios de Aceite do Pacote
- Não há conflitos semânticos entre os documentos.
- Cada documento possui critérios objetivos de aceite.
- Toda decisão relevante tem owner (papel) e forma de medição.

## Riscos e Limitações
- Decisões de roadmap e NFR podem evoluir após dados reais de piloto.
- Integrações externas podem exigir refinamentos de contrato.

## Changelog
- `v1.3.0` - 2026-02-14 - Inclusão de regra global para fallback de política comercial default.
- `v1.2.0` - 2026-02-14 - Inclusão de políticas comerciais e financeiras como documento dedicado.
- `v1.1.0` - 2026-02-14 - Revisão de metas/regras finas e consistência transversal.
- `v1.0.0` - 2026-02-14 - Estrutura inicial completa da documentação.

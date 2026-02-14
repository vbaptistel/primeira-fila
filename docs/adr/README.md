# ADR - Architecture Decision Records

## Objetivo
Registrar decisões arquiteturais estruturais de forma rastreável, com contexto e impacto técnico.

## Convenção de Arquivos
- Pasta: `docs/adr/`
- Formato: `NNNN-titulo-curto.md`
- Exemplo: `0001-backend-deploy-vercel.md`

## Quando abrir ADR
- Mudança de padrão arquitetural.
- Introdução ou remoção de tecnologia base.
- Quebra de contrato interno entre módulos.
- Exceção temporária de acoplamento entre módulos.

## Fluxo de Aprovação
1. Autor descreve contexto e decisão.
2. Engenharia revisa alternativas e consequências.
3. ADR aprovada e marcada como `Accepted`.
4. Implementação referenciando o ID da ADR.

## Template
Use `docs/adr/0000-template.md` como base obrigatória.

## Changelog
- `v1.1.0` - 2026-02-14 - Revisão textual para remover exemplos antigos não utilizados.
- `v1.0.0` - 2026-02-14 - Estrutura inicial de ADR.

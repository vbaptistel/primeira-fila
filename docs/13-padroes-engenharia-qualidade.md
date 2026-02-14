# Documento 13 - Padrões de Engenharia e Qualidade

## Objetivo
Definir padrões de código, testes, revisão e entrega para manter qualidade e previsibilidade técnica.

## Contexto
Com backend e frontend separados no mesmo repositório, regras de engenharia são necessárias para reduzir regressões e manter velocidade de entrega.

## Decisões Fechadas
- Desenvolvimento orientado a contratos (OpenAPI para integração backend/frontend).
- Cobertura mínima de testes por tipo de mudança.
- CI obrigatória para merge.
- Feature flag para mudanças de risco em produção.
- Testes de arquitetura obrigatórios para regras de dependência entre backend e frontend.

## Padrões de Código
- TypeScript em modo estrito.
- Funções e módulos pequenos, com responsabilidade única.
- Tratamento explícito de erro com códigos padronizados.
- Proibição de lógica de negócio em controllers e componentes visuais.
- Commits no padrão Conventional Commits.

## Padrões de Teste
- Unitário:
  - obrigatório para regra de domínio nova/alterada.
- Integração:
  - obrigatório para fluxos de persistência e integrações externas (gateway e e-mail).
- E2E:
  - obrigatório para jornadas críticas (checkout, emissão, check-in, reembolso).
- Regressão financeira:
  - obrigatório para alteração de cálculo de preço, taxa, reembolso e repasse.
- Arquitetura:
  - obrigatório para validar fronteiras de módulo e proibir acesso cruzado indevido entre `backend/` e `frontend/`.

## Metas de Cobertura
- `backend/src/modules` (camada de aplicação/domínio): mínimo de 80% de linhas.
- `frontend/packages/shared`: mínimo de 80% de linhas.
- Cobertura global não substitui teste de cenário crítico.

## Padrões de Pull Request
- PR pequena e focada por objetivo.
- Checklist obrigatório:
  - testes incluídos/atualizados;
  - contratos OpenAPI atualizados quando necessário;
  - documentação alterada quando houver mudança funcional;
  - plano de rollback para alterações de risco.
- Aprovação mínima:
  - 1 reviewer técnico;
  - 1 reviewer de domínio quando impactar regra de negócio.

## Pipeline CI (obrigatório)
1. Instalação e cache.
2. Lint.
3. Typecheck.
4. Testes unitários.
5. Testes de arquitetura.
6. Testes de integração.
7. Build das aplicações impactadas.
8. E2E em ambiente de validação para mudanças críticas.

## Padrões de Release
- Backend:
  - build de imagem Docker;
  - deploy em slot `staging` no App Service;
  - smoke test;
  - swap manual para produção.
- Frontend:
  - deploy independente por app na Vercel.

## Segurança no Ciclo de Desenvolvimento
- Secret scanning no CI.
- Dependabot ou equivalente para atualização de dependências.
- SAST no pipeline para detectar vulnerabilidades comuns.

## Regras e Critérios de Aceite
- Nenhum merge sem CI verde.
- Alterações de regra de negócio sem teste são bloqueadas.
- Alterações de contrato sem atualização documental são bloqueadas.
- Import cruzado entre `backend/` e `frontend/` é bloqueado por regra de arquitetura/lint.

## Riscos e Limitações
- Cobertura numérica sem bons cenários pode gerar falsa confiança.
- PRs grandes reduzem qualidade de revisão e aumentam risco de regressão.

## Changelog
- `v2.0.0` - 2026-02-14 - Remoção de dependências de outbox/DLQ e alinhamento com backend síncrono + deploy Azure/Vercel.
- `v1.2.0` - 2026-02-14 - Ajuste de cobertura e critérios para separação backend/frontend.
- `v1.1.0` - 2026-02-14 - Inclusão de testes de arquitetura e validação obrigatória de outbox/DLQ.
- `v1.0.0` - 2026-02-14 - Definição inicial dos padrões de engenharia e qualidade.

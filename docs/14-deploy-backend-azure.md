# Documento 14 - Deploy do Backend na Azure

## Objetivo
Definir arquitetura, pipeline e runbook de deploy do backend na Azure para o MVP.

## Contexto
Backend único em container Docker, com processamento totalmente síncrono nesta fase, publicação em ambiente Azure e rollback por slot swap manual.

## Decisões Fechadas
- Plataforma: Azure App Service Linux (container custom).
- SKU inicial: `S1`, 1 instância.
- Registry: Azure Container Registry (ACR).
- Banco: Azure Database for PostgreSQL Flexible Server 18.
- Rede do banco: acesso público restrito por firewall + SSL obrigatório.
- CI/CD: GitHub Actions.
- Estratégia de deploy: slot `staging` + swap para `production`.
- Rollback: swap reverso manual.
- Observabilidade: Application Insights + Log Analytics.

## Arquitetura de Recursos (MVP)
- `rg-primeirafila-prod` (Resource Group)
- `asp-primeirafila-prod` (App Service Plan S1)
- `app-primeirafila-api` (App Service)
- `app-primeirafila-api-staging` (slot)
- `acrprimeirafila` (ACR)
- `psql-primeirafila-prod` (PostgreSQL Flexible Server 18)
- `appi-primeirafila-api` (Application Insights)
- `log-primeirafila` (Log Analytics Workspace)

## Configuração do Backend App Service
- Runtime por imagem Docker no ACR.
- Startup health endpoint: `/health`.
- HTTPS only habilitado.
- Always On habilitado.
- Variáveis sensíveis via App Settings/Key Vault reference.

## Configuração do PostgreSQL
- `sslmode=require` em todas as conexões.
- Firewall permitindo apenas:
  - outbound do App Service;
  - IPs de execução de migração controlada.
- Usuário de aplicação com menor privilégio necessário.

## Pipeline CI/CD (GitHub Actions)
1. Trigger em `push` na branch principal.
2. Build de imagem Docker multi-stage.
3. Scan de segurança de imagem.
4. Push da imagem para ACR.
5. Deploy da imagem no slot `staging`.
6. Execução de smoke test (`/health`, endpoint crítico de leitura).
7. Aprovação manual.
8. Slot swap `staging -> production`.
9. Registro de versão e auditoria de deploy.

## Estratégia de Rollback
- Critérios de rollback:
  - aumento sustentado de 5xx;
  - degradação de latência além de SLO por janela definida;
  - falha funcional crítica em compra/check-in.
- Ação de rollback:
  1. Executar swap reverso `production -> staging`.
  2. Confirmar saúde da versão anterior.
  3. Abrir incidente e registrar causa raiz preliminar.

## Observabilidade Operacional
- Logs de aplicação e infraestrutura no Application Insights.
- Consultas e retenção operacional no Log Analytics.
- Dashboards de acompanhamento:
  - taxa de erro 5xx;
  - latência p95;
  - disponibilidade;
  - falhas de integração com gateway.

## Segurança de Pipeline
- Autenticação GitHub -> Azure via OIDC (sem secret estático quando possível).
- RBAC mínimo para identidade de deploy.
- Secret scanning e SAST obrigatórios no pipeline.

## Regras e Critérios de Aceite
- Deploy em produção apenas via slot swap.
- Nenhum deploy sem smoke test de staging aprovado.
- Rollback manual deve estar operacional e testado.
- Monitoramento ativo com alertas configurados no go-live.

## Riscos e Limitações
- `S1` com 1 instância não oferece alta disponibilidade real.
- Alterações de IP de saída podem exigir atualização de firewall do PostgreSQL.
- Deploys em horário de pico aumentam risco operacional.

## Changelog
- `v1.0.0` - 2026-02-14 - Definição inicial do padrão de deploy backend na Azure.

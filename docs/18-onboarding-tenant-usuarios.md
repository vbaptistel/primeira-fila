# Documento 18 - Onboarding de tenant e gestão de usuários

## Objetivo
Definir o fluxo de onboarding completo de tenant na plataforma e a criação de usuários com roles e metadata (tenant_id) via API, permitindo gestão de usuários por tenant com limite configurável. A UI de gestão da plataforma (frontend dedicado para platform_admin) fica para fase posterior.

## Contexto
Hoje os usuários do backoffice existem apenas no Supabase Auth; role e tenant_id são definidos em app_metadata via script `set-admin-user.ts` com service role. Não há criação de usuários nem onboarding de tenant pela plataforma. Este documento operacionaliza as decisões de produto e arquitetura para corrigir essa lacuna no backend e no backoffice, deixando o frontend dedicado à plataforma (web-platform) para depois.

## Decisões Fechadas
- **Quem cria usuários:** platform_admin pode criar usuários em qualquer tenant; organizer_admin pode adicionar usuários (operator ou organizer_admin) apenas ao próprio tenant.
- **Limite por tenant:** campo opcional no model Tenant (ex.: `maxUsers`); valor default vem de config global (variável de ambiente ou tabela de config). Ao criar usuário, validar que a contagem atual de membros do tenant não excede o limite.
- **Listagem de usuários:** incluir no escopo: endpoint e tela no backoffice para listar usuários do tenant. Utilizar tabela `tenant_members` (espelho do app_metadata) para contagem e listagem.
- **Criação de usuário:** sempre email + senha definida pelo admin (sem fluxo de convite por link no MVP).
- **Frontend de plataforma:** a UI de gestão da plataforma (lista de tenants, criar tenant, criar/listar usuários por tenant para platform_admin) será implementada em **frontend separado** (ex.: web-platform) em **fase posterior**. No MVP, onboarding e gestão de usuários são realizáveis via API (e, no backoffice, tela de usuários do tenant para organizer_admin).

## Entidades e modelo
- **Tenant:** acrescentar campo opcional `maxUsers` (Int). Default do limite: config global (ex.: `TENANT_MAX_USERS_DEFAULT`).
- **TenantMember:** nova entidade (tenant_id, auth_user_id, role, createdAt). Espelho para leitura e contagem; fonte de verdade de role/tenant_id permanece no app_metadata do Supabase. Sincronizada na criação/atualização de usuário via Supabase Admin API.
- **User (identidade):** permanece no Supabase Auth; perfil e escopo (role, tenant_id) em app_metadata, conforme Documento 3.

## Backend – Serviço e endpoints
- **Serviço:** encapsular Supabase Admin API (createUser, updateUserById) com app_metadata (role, tenant_id). Usar apenas SUPABASE_SERVICE_ROLE_KEY no backend. Validar role em APP_ROLES e existência do tenant; ao criar usuário, inserir/atualizar registro em `tenant_members` e respeitar limite (contagem de membros não excede tenant.maxUsers ou default global).
- **POST /v1/tenants/:tenantId/users**  
  - Body: `{ email, password, role }` (role: organizer_admin ou operator).  
  - Auth: platform_admin ou organizer_admin; se organizer_admin, principal.tenantId deve ser igual a tenantId.  
  - Resposta: 201 com dados do usuário criado (id, email, role); 400 se limite excedido ou role inválido; 403 se organizer_admin em outro tenant.
- **GET /v1/tenants/:tenantId/users**  
  - Listagem de usuários do tenant (a partir de tenant_members ou Supabase filtrado).  
  - Auth: platform_admin ou organizer_admin do próprio tenant.
- **GET /v1/tenants**  
  - Listagem de tenants (paginação cursor-based). Apenas platform_admin.  
  - Necessário para operações de platform_admin até existir frontend dedicado (uso via API/ferramentas).
- **PATCH /v1/tenants/:tenantId/users/:userId** (opcional no MVP): atualizar role do usuário no tenant; regras de quem pode alterar (platform_admin ou organizer_admin) e restrições (ex.: organizer_admin não elevar para platform_admin).

## Fluxo de onboarding completo (dois passos)
1. Platform_admin autenticado chama **POST /v1/tenants** com dados do tenant (como hoje).
2. Resposta retorna tenant.id.
3. Platform_admin chama **POST /v1/tenants/:tenantId/users** com `{ email, password, role: "organizer_admin" }`.
4. Backend cria usuário no Supabase com app_metadata e registra em tenant_members.
5. Novo usuário faz login no web-backoffice com email/senha; JWT já contém tenant_id e role.

## Frontend (escopo MVP)
- **web-backoffice:** tela "Usuários" no dashboard do tenant para organizer_admin (e platform_admin quando acessar um tenant) listar usuários do tenant e adicionar usuário (POST /v1/tenants/:tenantId/users). Consome GET/POST já descritos.
- **Frontend dedicado à plataforma (web-platform):** **adiado**. Listagem de todos os tenants, criação de tenant, criação do primeiro usuário admin e gestão de usuários por tenant para platform_admin ficam para fase posterior. Até lá, platform_admin utiliza API diretamente ou script set-admin-user para o primeiro usuário de um tenant.

## Regras e critérios de aceite
- Backend expõe os endpoints acima com RBAC e validação de limite.
- Tabela tenant_members mantida consistente com criação/atualização de usuário no Supabase.
- Documentação de contratos (Documento 5), fluxos (Documento 6), modelo (Documento 3) e tasks (Documento 16) atualizadas.
- Script set-admin-user mantido para uso operacional (primeiro platform_admin, correções emergenciais).

## Riscos e limitações
- Criação/atualização de usuário com app_metadata exige Service Role Key no backend; endpoints devem ser estritamente protegidos.
- tenant_members deve ser atualizada na mesma lógica que chama Supabase Admin para evitar divergência.

## Referências
- Documento 3 (modelo de domínio); Documento 5 (contratos API); Documento 6 (fluxos de usuário); Documento 16 (tasks e sprints). Plano de onboarding em `.cursor/plans/` (decisões do usuário e detalhes técnicos).

## Changelog
- `v1.0.0` - 2026-02-15 - Versão inicial: decisões de onboarding, limite por tenant, tenant_members, endpoints e fluxo; frontend de plataforma adiado; reflete atualização transversal da documentação (docs 03, 05, 06, 16 e README).

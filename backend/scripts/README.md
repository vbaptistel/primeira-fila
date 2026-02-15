# Scripts do Backend

## set-display-name

Define o **display name** (nome de exibição) de um usuário no Supabase Auth. Atualiza `user_metadata.full_name`, usado pelo Supabase para exibir o nome do usuário no Dashboard e nos JWTs.

### Uso

```bash
npm run script:set-display-name --workspace @primeira-fila/backend -- --email usuario@exemplo.com --display-name "João Silva"
```

### Opções

| Opção            | Descrição                                      |
|------------------|------------------------------------------------|
| `--email`        | E-mail do usuário (para buscar)                |
| `--user-id`      | UUID do usuário no Supabase Auth               |
| `--display-name` | Nome de exibição (obrigatório)                 |

### Exemplos

```bash
npm run script:set-display-name --workspace @primeira-fila/backend -- --email admin@plataforma.com --display-name "Admin Plataforma"
npm run script:set-display-name --workspace @primeira-fila/backend -- --user-id <uuid> --display-name "Maria Santos"
```

---

## set-admin-user

Cria ou atualiza um usuário no **Supabase Auth** e define `app_metadata` (`role` e opcionalmente `tenant_id`) para o RBAC do backend.

### Variáveis de ambiente

No `.env` do backend (ou `backend/.env`), além de `SUPABASE_URL`:

- **`SUPABASE_SERVICE_ROLE_KEY`**: chave **service_role** do projeto Supabase (Dashboard → Settings → API). Essa chave permite operações administrativas no Auth (criar/atualizar usuários e metadata). **Não** use no código da API em produção; use apenas em scripts de provisionamento ou localmente.

### Uso

Executar da **raiz do repositório**:

```bash
npm run script:set-admin --workspace @primeira-fila/backend -- --email admin@exemplo.com --role platform_admin
```

Ou a partir de `backend/`:

```bash
npm run script:set-admin -- --email admin@exemplo.com --role platform_admin
```

### Opções

| Opção        | Descrição                                                                 |
|-------------|-----------------------------------------------------------------------------|
| `--email`   | E-mail do usuário (para buscar e atualizar, ou para criar junto com `--password`) |
| `--user-id` | UUID do usuário no Supabase Auth (alternativa a buscar por e-mail)         |
| `--role`    | Obrigatório. Uma de: `platform_admin`, `organizer_admin`, `operator`, `buyer` |
| `--tenant-id` | UUID do tenant (recomendado para `organizer_admin` e `operator`)         |
| `--password` | Ao criar usuário: senha (use junto com `--email` e `--role`)             |

### Exemplos

- Atualizar metadata de um usuário existente para **platform_admin** (por e-mail):

  ```bash
  npm run script:set-admin --workspace @primeira-fila/backend -- --email admin@plataforma.com --role platform_admin
  ```

- Atualizar por **user id** (UUID do Auth):

  ```bash
  npm run script:set-admin --workspace @primeira-fila/backend -- --user-id <uuid> --role platform_admin
  ```

- Definir **organizer_admin** com tenant:

  ```bash
  npm run script:set-admin --workspace @primeira-fila/backend -- --email org@eventos.com --role organizer_admin --tenant-id a1a1a1a1-0000-4000-a000-000000000001
  ```

- **Criar** novo usuário admin (e-mail confirmado):

  ```bash
  npm run script:set-admin --workspace @primeira-fila/backend -- --email novo@plataforma.com --password "senhaSegura123" --role platform_admin
  ```

O backend lê `app_metadata.role` e `app_metadata.tenant_id` do JWT; após atualizar, o usuário precisa fazer login novamente para obter um token com as novas claims.

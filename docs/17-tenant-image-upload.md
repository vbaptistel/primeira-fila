
# Upload de Imagens do Tenant

Este documento descreve os endpoints da API para upload de imagens do tenant (logo e favicon) para o Supabase Storage.

## Visão Geral

As imagens do tenant são armazenadas em um bucket do Supabase Storage chamado `tenant-assets`. O backend lida com o upload do arquivo via requisições `multipart/form-data` e atualiza o registro do Tenant correspondente com a URL pública da imagem enviada.

## Endpoints

### Upload de Logo

Faz o upload de uma imagem de logo para um tenant específico.

- **URL**: `/v1/tenants/:tenantId/upload/logo`
- **Método**: `POST`
- **Auth**: Necessário (`organizer_admin`, `platform_admin`)
- **Headers**:
    - `Content-Type`: `multipart/form-data`
- **Body**:
    - `file`: O arquivo de imagem (binário).
- **Resposta**:
    - `201 Created`: Retorna o objeto Tenant atualizado.

### Upload de Favicon

Faz o upload de uma imagem de favicon para um tenant específico.

- **URL**: `/v1/tenants/:tenantId/upload/favicon`
- **Método**: `POST`
- **Auth**: Necessário (`organizer_admin`, `platform_admin`)
- **Headers**:
    - `Content-Type`: `multipart/form-data`
- **Body**:
    - `file`: O arquivo de imagem (binário).
- **Resposta**:
    - `201 Created`: Retorna o objeto Tenant atualizado.

## Configuração do Storage

- **Bucket**: `tenant-assets`
- **Estrutura de Caminho**:
    - Logo: `tenants/:tenantId/logo.:ext`
    - Favicon: `tenants/:tenantId/favicon.:ext`
- **Acesso Público**: O bucket `tenant-assets` deve ser configurado como público ou ter políticas apropriadas para permitir acesso de leitura pública para as URLs geradas serem acessíveis pelo frontend.

## Exemplo de Uso (cURL)

```bash
curl -X POST http://localhost:3001/v1/tenants/<tenant-id>/upload/logo \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/logo.png"
```

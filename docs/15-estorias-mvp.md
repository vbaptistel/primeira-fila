# Documento 15 - Estórias do MVP

## Objetivo
Consolidar as estórias de usuário do MVP com escopo funcional, prioridade e critérios de aceite rastreáveis.

## Contexto
As estórias abaixo foram derivadas dos documentos de domínio, arquitetura, contratos de API, políticas comerciais e roadmap.

## Convenções
- Prioridade:
  - `P0`: bloqueante para operação do MVP.
  - `P1`: essencial para operação de produção inicial.
  - `P2`: importante, mas pode entrar após validação inicial.
- Status da estória:
  - `Aprovada`
  - `Em Refinamento`
  - `Concluída`

## Estórias
| ID | Persona | Estória | Critérios de Aceite | Prioridade | Status |
|---|---|---|---|---|---|
| `US-001` | Comprador | Como comprador, quero navegar eventos por sessão para escolher meu ingresso. | Listagem por evento/sessão publicada; detalhes de sessão com preço e disponibilidade; erro amigável para sessão indisponível. | `P0` | `Aprovada` |
| `US-002` | Comprador | Como comprador, quero reservar assentos por 10 minutos para concluir compra sem perder seleção. | Hold criado com `expires_at`; liberação automática ao expirar; conflito de assento retorna erro consistente. | `P0` | `Aprovada` |
| `US-003` | Comprador | Como comprador, quero pagar online com confirmação segura da compra. | Pedido em `pending_payment`; pagamento confirmado/negado; webhook idempotente; pedido expira sem confirmação no prazo. | `P0` | `Aprovada` |
| `US-004` | Comprador | Como comprador, quero receber e acessar meu ingresso com QR após pagamento aprovado. | Ticket `valid` gerado após pagamento; QR único por sessão; ticket disponível no portal do comprador. | `P0` | `Aprovada` |
| `US-005` | Operador | Como operador, quero validar QR em tempo real para controlar entrada sem duplicidade. | Check-in só aprova ticket válido da sessão; segundo uso retorna negação; auditoria registra operador e horário. | `P0` | `Aprovada` |
| `US-006` | Organizer Admin | Como organizador, quero cadastrar evento, dias e sessões para iniciar vendas rapidamente. | CRUD de evento/dia/sessão; publicação de sessão; validações mínimas obrigatórias. | `P0` | `Aprovada` |
| `US-007` | Organizer Admin | Como organizador, quero configurar mapa de assentos (setor, fileira, número) por sessão. | Assentos únicos por `setor+fileira+número`; status de assento por sessão; bloqueio/liberação operacional. | `P0` | `Aprovada` |
| `US-008` | Organizer Admin | Como organizador, quero consultar pedidos, pagamentos e ingressos da minha operação. | Filtro por evento/sessão/status; escopo por tenant; dados financeiros coerentes com política ativa no pedido. | `P1` | `Aprovada` |
| `US-009` | Organizer Admin | Como organizador, quero solicitar reembolso manual conforme política comercial. | Reembolso só com elegibilidade válida; motivo obrigatório; atualização de estados financeiros e ticket; trilha de auditoria. | `P1` | `Aprovada` |
| `US-010` | Platform Admin | Como administrador da plataforma, quero manter política comercial versionada por tenant. | Default `platform_default_v1`; mudança não retroativa; snapshot financeiro no pedido com versão aplicada. | `P1` | `Aprovada` |
| `US-011` | Platform Admin | Como administrador, quero isolar acesso por tenant para segurança de dados. | RBAC por tenant em todas as operações; tentativas de acesso cruzado bloqueadas e auditadas. | `P0` | `Aprovada` |
| `US-012` | Operador / Organizer Admin | Como usuário do backoffice, quero autenticação segura e sessão estável no `web-backoffice`. | Login via Supabase Auth; sessão com cookie seguro (`HttpOnly`); renovação e logout via provider; backend valida escopo de acesso por tenant. No MVP o comprador acessa ingressos via magic link, sem login. | `P1` | `Aprovada` |
| `US-013` | Engenharia | Como time técnico, quero deploy confiável do backend na Vercel com rollback rápido. | Deploy automático em `production` na branch principal; smoke test obrigatório; rollback por promoção/redeploy da versão estável anterior. | `P0` | `Aprovada` |
| `US-014` | Engenharia | Como time técnico, quero separar backend e frontend sem compartilhamento de código. | Estrutura `backend/` e `frontend/`; pacote `frontend/packages/shared`; bloqueio de import cruzado em CI. | `P0` | `Aprovada` |
| `US-015` | Engenharia | Como time técnico, quero observabilidade operacional para detectar falhas rapidamente. | Logs estruturados e métricas operacionais ativos; alertas de latência/erro; correlação por `trace_id`. | `P1` | `Aprovada` |

## Regras e Critérios de Aceite
- Toda estória deve mapear para uma ou mais tasks no Documento 16.
- Estória `P0` não pode ficar fora do escopo do MVP.
- Critérios de aceite devem ser testáveis e observáveis.

## Riscos e Limitações
- Escopo do MVP pode pressionar inclusão de estórias `P2` antes da estabilização das `P0`.
- Dependências externas (gateway, e-mail, Supabase e plataforma de deploy) podem impactar previsibilidade de entrega.

## Changelog
- `v1.3.0` - 2026-02-15 - US-012: persona alterada de Comprador para Operador/Organizer Admin; escopo explícito de autenticação no `web-backoffice`; critério de aceite esclarece que no MVP o comprador usa magic link sem login.
- `v1.2.0` - 2026-02-14 - Atualização da estória de autenticação para Supabase Auth.
- `v1.1.0` - 2026-02-14 - Ajuste das estórias técnicas para deploy backend na Vercel e observabilidade agnóstica de provedor.
- `v1.0.0` - 2026-02-14 - Primeira versão das estórias do MVP.

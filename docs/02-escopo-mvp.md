# Documento 2 - Escopo do MVP

## Objetivo
Definir claramente o que entra e o que não entra no MVP, com regras de negócio e critérios de aceite.

## Contexto
O MVP busca validar venda e operação de ingressos ponta a ponta, com confiabilidade, para organizadores de pequeno e médio porte.

## Decisões Fechadas
- Checkout sem login obrigatório.
- Taxa da plataforma configurável por organizador.
- Reembolso manual por organizer admin ou platform admin.
- Suporte operacional por e-mail e painel do organizador.
- Controles antifraude básicos internos.
- Repasse ao organizador manual, fora da plataforma.
- Limite inicial para eventos com assento marcado: até `5.000` lugares por evento.
- Timeout de pagamento não estende hold automaticamente.
- Políticas de taxa, reembolso e repasse seguem o Documento 9.

## In-scope
- Multi-tenant white-label por subdomínio.
- Web responsivo para compra, operação e backoffice.
- Cadastro e gestão de evento, dias e sessões.
- Venda por lote/setor e assento marcado.
- Pagamento online com um gateway.
- Emissão de ingresso com QR.
- Check-in com bloqueio de duplo uso.
- Reembolso manual com trilha de auditoria.
- E-mail transacional de confirmação e ingresso.
- Conciliação financeira e trilha para repasse manual.
- Política comercial parametrizável por tenant (taxas, janelas e motivos de reembolso).

## Out-of-scope
- App mobile nativo.
- Integração com catraca/hardware.
- Múltiplos gateways de pagamento.
- Repasse automático integrado.
- Notificação transacional por WhatsApp ou SMS.
- Operação internacional/multi-moeda.
- Recursos enterprise avançados (exemplo: SSO/SAML).

## Regras de Negócio
- Pedido inicia em `pending_payment`.
- Hold de inventário expira automaticamente em 10 minutos.
- Se pagamento não for confirmado até a expiração do hold, pedido muda para `expired` e inventário é liberado.
- Webhook de pagamento deve ser idempotente.
- Preço e taxas aplicadas no pedido devem ser congeladas no momento da criação do pedido.
- Ticket só pode ser emitido após confirmação de pagamento.
- Check-in só pode aprovar ticket válido e da sessão correta.
- Reembolso altera estado financeiro e estado do ticket.
- Reembolso é permitido apenas para ticket não utilizado.
- Todo acesso de dados deve respeitar `tenant_id`.

## Regras de Operação
- Check-in offline não é suportado no MVP.
- Antifraude inicial inclui rate limit em login, checkout, pagamento e validação de QR.
- Repasse financeiro é executado fora da plataforma, com conciliação interna obrigatória.
- Repasse considera apenas pedidos pagos sem pendência de reembolso ou chargeback na data de corte.
- Tenant sem política customizada utiliza `platform_default_v1` até nova versão entrar em vigor.

## Critérios de Aceite
- Fluxo completo de compra até check-in funcional.
- Reembolso manual auditável ponta a ponta.
- Isolamento de tenant validado em autorização e consulta.
- Não objetivos fora do backlog do MVP inicial.
- Cálculo financeiro e janelas de reembolso aderentes ao Documento 9.

## Riscos e Limitações
- Escopo de assento marcado pode elevar complexidade de concorrência.
- Processo de repasse manual exige disciplina operacional.
- Antifraude básico pode precisar de reforço após aumento de volume.

## Changelog
- `v1.3.0` - 2026-02-14 - Regra operacional de fallback para política comercial default por tenant.
- `v1.2.0` - 2026-02-14 - Inclusão do vínculo obrigatório com políticas comerciais e regras de congelamento de taxa.
- `v1.1.0` - 2026-02-14 - Ajuste de regra fina para timeout/expiração e critérios operacionais.
- `v1.0.0` - 2026-02-14 - Versão inicial.

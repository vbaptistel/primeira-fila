# Documento 1 - Visão do Produto

## Objetivo
Definir posicionamento, proposta de valor, metas iniciais e limites do MVP.

## Contexto
Plataforma white-label de ingressos para organizadores de pequeno e médio porte no Brasil, com operação web responsiva e foco em confiabilidade operacional.

## Decisões Fechadas
- Modelo: white-label para organizadores.
- Canal inicial: web responsivo.
- Mercado inicial: Brasil.
- Diferencial: operação simples e check-in confiável com preservação da marca do organizador.
- Prioridade de trade-off: confiabilidade operacional acima de velocidade de release.

## Problema
Organizadores usam fluxos fragmentados de venda, emissão e entrada, o que aumenta retrabalho, risco de falha no acesso e perda de receita.

## Público-alvo Inicial
- Organizadores de pequeno e médio porte.
- Eventos presenciais gerais: shows, festas, esportivos locais e eventos de médio porte.

## Proposta de Valor
Permitir que o organizador venda e opere eventos com marca própria, em fluxo unificado de publicação, checkout, emissão e check-in por QR.

## North Star e Metas de 90 dias
- North Star: ingressos validados.
- Metas conservadoras:
  - `10.000` ingressos validados acumulados.
  - `>= 99,0%` de sucesso na validação de QR.
  - `<= 30 min` para publicar evento padrão.
  - `>= 35%` de conversão de checkout iniciado para pedido pago.
  - `>= 20` organizadores ativos no período.

## Definições de Medição
- Ingressos validados: contagem de `ticket_id` únicos com check-in aprovado.
- Sucesso de QR: `check-ins aprovados / tentativas totais de check-in`.
- Tempo de publicação: tempo entre criação do evento e primeira sessão em status publicada.
- Conversão de checkout: `pedidos pagos / checkouts iniciados`.
- Organizador ativo: tenant com pelo menos 1 pedido pago ou 1 sessão com check-in no período.

## Regra de Avaliação ao fim de 90 dias
- Critério de sucesso: atingir a North Star e pelo menos 3 das 4 metas secundárias.
- Se não atingir: revisar escopo, ICP e jornada de checkout antes de ampliar rollout.

## Não Objetivos deste Recorte
- Integração com catraca/hardware.
- Múltiplos gateways no início.
- Expansão internacional no primeiro ciclo.

## Regras e Critérios de Aceite
- Decisões de produto devem refletir ICP e foco de confiabilidade.
- Metas devem ser rastreáveis por métricas operacionais.
- Não objetivos devem ser respeitados no backlog do MVP.

## Riscos e Limitações
- Metas podem precisar de ajuste após dados de piloto.
- Pressão comercial pode induzir escopo fora do recorte inicial.

## Changelog
- `v1.1.0` - 2026-02-14 - Definições formais de medição e regra de avaliação de 90 dias.
- `v1.0.0` - 2026-02-14 - Versão inicial.

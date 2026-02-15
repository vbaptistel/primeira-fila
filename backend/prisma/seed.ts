/**
 * Seed completo para testes do frontend.
 *
 * Execução:
 *   npx prisma db seed
 *   npm run db:seed
 *
 * Cria dados realistas para dois tenants (Arena Shows e Teatro São Paulo)
 * com eventos, sessões, assentos, pedidos pagos/pendentes e ingressos.
 */

import "../src/config/load-env";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  EventStatus,
  SessionStatus,
  SessionSeatStatus,
  SessionHoldStatus,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  TicketStatus,
} from "../src/generated/prisma/client";
import { randomUUID } from "node:crypto";

// ─── Constantes ─────────────────────────────────────────────────────────────

const TENANT_ARENA = "a1a1a1a1-0000-4000-a000-000000000001";
const TENANT_TEATRO = "b2b2b2b2-0000-4000-b000-000000000002";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Retorna uma data a N dias de hoje, no horário informado. */
function daysFromNow(days: number, hours = 20, minutes = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/** Retorna uma data N horas após a data base. */
function hoursAfter(base: Date, h: number): Date {
  return new Date(base.getTime() + h * 60 * 60 * 1000);
}

/** Retorna somente a data (meia-noite) a N dias de hoje. */
function dateOnly(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface SeatData {
  id: string;
  tenantId: string;
  sessionId: string;
  sectorCode: string;
  rowLabel: string;
  seatNumber: number;
  status: SessionSeatStatus;
}

/** Gera N fileiras × M assentos para uma sessão. */
function makeSeats(
  tenantId: string,
  sessionId: string,
  sectorCode: string,
  rowCount: number,
  seatsPerRow: number,
): SeatData[] {
  const seats: SeatData[] = [];
  for (let r = 0; r < rowCount; r++) {
    const rowLabel = String.fromCharCode(65 + r);
    for (let s = 1; s <= seatsPerRow; s++) {
      seats.push({
        id: randomUUID(),
        tenantId,
        sessionId,
        sectorCode,
        rowLabel,
        seatNumber: s,
        status: SessionSeatStatus.AVAILABLE,
      });
    }
  }
  return seats;
}

/** Calcula a taxa de serviço a partir do subtotal. */
function computeFee(subtotalCents: number, bps: number, fixedCents: number): number {
  return Math.round((subtotalCents * bps) / 10000) + fixedCents;
}

// ─── Criação completa de pedido ─────────────────────────────────────────────

interface OrderInput {
  tenantId: string;
  sessionId: string;
  seats: SeatData[];
  priceCents: number;
  buyer: { name: string; email: string; document?: string };
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  policyVersion: string;
  feePercentBps: number;
  feeFixedCents: number;
}

/**
 * Cria o fluxo completo: Hold → Order → OrderItems → Payment → Tickets.
 * Atualiza o status dos assentos conforme o estado do pedido.
 */
async function createFullOrder(prisma: PrismaClient, opts: OrderInput): Promise<void> {
  const holdId = randomUUID();
  const orderId = randomUUID();
  const paymentId = randomUUID();

  const subtotal = opts.seats.length * opts.priceCents;
  const fee = computeFee(subtotal, opts.feePercentBps, opts.feeFixedCents);
  const total = subtotal + fee;

  const holdStatus: SessionHoldStatus =
    opts.orderStatus === OrderStatus.PAID
      ? SessionHoldStatus.CONSUMED
      : opts.orderStatus === OrderStatus.EXPIRED
        ? SessionHoldStatus.EXPIRED
        : SessionHoldStatus.ACTIVE;

  const holdExpiry =
    opts.orderStatus === OrderStatus.PENDING_PAYMENT
      ? daysFromNow(1)
      : daysFromNow(-1);

  // Hold
  await prisma.sessionHold.create({
    data: {
      id: holdId,
      tenantId: opts.tenantId,
      sessionId: opts.sessionId,
      status: holdStatus,
      expiresAt: holdExpiry,
    },
  });

  // Hold → Seats
  await prisma.sessionHoldSeat.createMany({
    data: opts.seats.map((s) => ({ holdId, seatId: s.id })),
  });

  // Order
  await prisma.order.create({
    data: {
      id: orderId,
      tenantId: opts.tenantId,
      sessionId: opts.sessionId,
      holdId,
      idempotencyKey: `seed-ord-${orderId}`,
      requestHash: `seed-rh-${orderId.slice(0, 16)}`,
      status: opts.orderStatus,
      buyerName: opts.buyer.name,
      buyerEmail: opts.buyer.email,
      buyerDocument: opts.buyer.document,
      ticketSubtotalCents: subtotal,
      serviceFeeCents: fee,
      totalAmountCents: total,
      commercialPolicyVersion: opts.policyVersion,
      holdExpiresAt: holdExpiry,
    },
  });

  // OrderItems (gera IDs para vincular tickets depois)
  const orderItemData = opts.seats.map((s) => ({
    id: randomUUID(),
    orderId,
    sessionId: opts.sessionId,
    seatId: s.id,
    unitPriceCents: opts.priceCents,
    currencyCode: "BRL",
  }));
  await prisma.orderItem.createMany({ data: orderItemData });

  // Payment
  await prisma.payment.create({
    data: {
      id: paymentId,
      tenantId: opts.tenantId,
      orderId,
      idempotencyKey: `seed-pay-${paymentId}`,
      requestHash: `seed-rh-${paymentId.slice(0, 16)}`,
      provider: "mock_gateway",
      providerPaymentId: `mock-${paymentId}`,
      method: opts.paymentMethod,
      status: opts.paymentStatus,
      amountCents: total,
      currencyCode: "BRL",
      approvedAt:
        opts.paymentStatus === PaymentStatus.APPROVED ? daysFromNow(-1) : undefined,
    },
  });

  // Tickets (apenas para pedidos pagos)
  if (opts.orderStatus === OrderStatus.PAID) {
    await prisma.ticket.createMany({
      data: orderItemData.map((item) => ({
        tenantId: opts.tenantId,
        orderId,
        orderItemId: item.id,
        sessionId: opts.sessionId,
        seatId: item.seatId,
        qrCode: `QR-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`,
        status: TicketStatus.VALID,
      })),
    });

    await prisma.sessionSeat.updateMany({
      where: { id: { in: opts.seats.map((s) => s.id) } },
      data: { status: SessionSeatStatus.SOLD },
    });
  } else if (opts.orderStatus === OrderStatus.PENDING_PAYMENT) {
    await prisma.sessionSeat.updateMany({
      where: { id: { in: opts.seats.map((s) => s.id) } },
      data: { status: SessionSeatStatus.HELD },
    });
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Variável DATABASE_URL não configurada.");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // ══════════════════════════════════════════════════════════════════════
    //  Limpeza
    // ══════════════════════════════════════════════════════════════════════
    console.log("Limpando dados existentes...");
    await prisma.emailLog.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.refund.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();
    await prisma.sessionHoldSeat.deleteMany();
    await prisma.sessionHold.deleteMany();
    await prisma.sessionSeat.deleteMany();
    await prisma.session.deleteMany();
    await prisma.eventDay.deleteMany();
    await prisma.event.deleteMany();
    await prisma.commercialPolicy.deleteMany();
    await prisma.tenant.deleteMany();

    // ══════════════════════════════════════════════════════════════════════
    //  Tenants
    // ══════════════════════════════════════════════════════════════════════
    console.log("Criando tenants...");
    await prisma.tenant.createMany({
      data: [
        {
          id: TENANT_ARENA,
          name: "Arena Shows",
          slug: "arena-shows",
          subdomain: "arena-shows",
          primaryColor: "#1A1A2E",
          secondaryColor: "#EAEAEA",
          accentColor: "#E94560",
          logoUrl: "https://placehold.co/200x80/1A1A2E/E94560?text=Arena+Shows",
          faviconUrl: "https://placehold.co/32x32/1A1A2E/E94560?text=A",
          footerText: "Arena Shows © 2026 — Todos os direitos reservados.",
          socialLinks: {
            instagram: "https://instagram.com/arenashows",
            twitter: "https://twitter.com/arenashows",
          },
        },
        {
          id: TENANT_TEATRO,
          name: "Teatro São Paulo",
          slug: "teatro-sao-paulo",
          subdomain: "teatro-sao-paulo",
          primaryColor: "#2D1B36",
          secondaryColor: "#F5F0EB",
          accentColor: "#C9A959",
          logoUrl: "https://placehold.co/200x80/2D1B36/C9A959?text=Teatro+SP",
          faviconUrl: "https://placehold.co/32x32/2D1B36/C9A959?text=T",
          footerText: "Teatro São Paulo © 2026 — Arte e cultura para todos.",
          termsUrl: "https://teatro-sao-paulo.com.br/termos",
          privacyUrl: "https://teatro-sao-paulo.com.br/privacidade",
          socialLinks: {
            instagram: "https://instagram.com/teatrosp",
            youtube: "https://youtube.com/teatrosp",
          },
        },
      ],
    });

    // ══════════════════════════════════════════════════════════════════════
    //  Políticas Comerciais
    // ══════════════════════════════════════════════════════════════════════
    console.log("Criando politicas comerciais...");
    await prisma.commercialPolicy.createMany({
      data: [
        {
          tenantId: TENANT_ARENA,
          version: "arena_v1",
          serviceFeePercentBps: 500, // 5%
          serviceFeeFixedCents: 200, // R$ 2,00
          effectiveFrom: daysFromNow(-90),
        },
        {
          tenantId: TENANT_TEATRO,
          version: "teatro_v1",
          serviceFeePercentBps: 800, // 8%
          serviceFeeFixedCents: 300, // R$ 3,00
          effectiveFrom: daysFromNow(-60),
        },
      ],
    });

    // ══════════════════════════════════════════════════════════════════════
    //  ARENA SHOWS — Eventos
    // ══════════════════════════════════════════════════════════════════════
    console.log("Criando eventos Arena Shows...");

    // Coleção de todos os seats para bulk insert
    const allSeats: SeatData[] = [];

    // ── Evento 1: Rock in Arena 2026 (PUBLISHED, 2 dias) ────────────────
    const rockId = randomUUID();
    const rockDay1Id = randomUUID();
    const rockDay2Id = randomUUID();
    const rockD1PistaId = randomUUID();
    const rockD1CamaroteId = randomUUID();
    const rockD2PistaId = randomUUID();
    const rockD2CamaroteId = randomUUID();

    await prisma.event.create({
      data: {
        id: rockId,
        tenantId: TENANT_ARENA,
        name: "Rock in Arena 2026",
        slug: "rock-in-arena-2026",
        description:
          "O maior festival de rock do Brasil está de volta! Dois dias de shows " +
          "épicos com as melhores bandas nacionais e internacionais. Prepare-se " +
          "para uma experiência inesquecível na Arena Shows com palcos gigantes, " +
          "food trucks e área VIP exclusiva.",
        status: EventStatus.PUBLISHED,
      },
    });

    await prisma.eventDay.createMany({
      data: [
        { id: rockDay1Id, tenantId: TENANT_ARENA, eventId: rockId, date: dateOnly(15) },
        { id: rockDay2Id, tenantId: TENANT_ARENA, eventId: rockId, date: dateOnly(16) },
      ],
    });

    const rockD1PistaStart = daysFromNow(15, 19, 0);
    const rockD1CamaroteStart = daysFromNow(15, 18, 0); // VIP abre antes
    const rockD2PistaStart = daysFromNow(16, 19, 0);
    const rockD2CamaroteStart = daysFromNow(16, 18, 0);

    await prisma.session.createMany({
      data: [
        {
          id: rockD1PistaId,
          tenantId: TENANT_ARENA,
          eventId: rockId,
          eventDayId: rockDay1Id,
          name: "Pista — Dia 1",
          startsAt: rockD1PistaStart,
          endsAt: hoursAfter(rockD1PistaStart, 5),
          salesStartsAt: daysFromNow(-7),
          salesEndsAt: daysFromNow(15, 17),
          priceCents: 25000,
          capacity: 30,
          status: SessionStatus.PUBLISHED,
        },
        {
          id: rockD1CamaroteId,
          tenantId: TENANT_ARENA,
          eventId: rockId,
          eventDayId: rockDay1Id,
          name: "Camarote VIP — Dia 1",
          startsAt: rockD1CamaroteStart,
          endsAt: hoursAfter(rockD1CamaroteStart, 6),
          salesStartsAt: daysFromNow(-7),
          salesEndsAt: daysFromNow(15, 16),
          priceCents: 50000,
          capacity: 20,
          status: SessionStatus.PUBLISHED,
        },
        {
          id: rockD2PistaId,
          tenantId: TENANT_ARENA,
          eventId: rockId,
          eventDayId: rockDay2Id,
          name: "Pista — Dia 2",
          startsAt: rockD2PistaStart,
          endsAt: hoursAfter(rockD2PistaStart, 5),
          salesStartsAt: daysFromNow(-7),
          salesEndsAt: daysFromNow(16, 17),
          priceCents: 25000,
          capacity: 30,
          status: SessionStatus.PUBLISHED,
        },
        {
          id: rockD2CamaroteId,
          tenantId: TENANT_ARENA,
          eventId: rockId,
          eventDayId: rockDay2Id,
          name: "Camarote VIP — Dia 2",
          startsAt: rockD2CamaroteStart,
          endsAt: hoursAfter(rockD2CamaroteStart, 6),
          salesStartsAt: daysFromNow(-7),
          salesEndsAt: daysFromNow(16, 16),
          priceCents: 50000,
          capacity: 20,
          status: SessionStatus.PUBLISHED,
        },
      ],
    });

    const rockD1PistaSeats = makeSeats(TENANT_ARENA, rockD1PistaId, "PISTA", 3, 10);
    const rockD1CamaroteSeats = makeSeats(TENANT_ARENA, rockD1CamaroteId, "CAMAROTE", 2, 10);
    const rockD2PistaSeats = makeSeats(TENANT_ARENA, rockD2PistaId, "PISTA", 3, 10);
    const rockD2CamaroteSeats = makeSeats(TENANT_ARENA, rockD2CamaroteId, "CAMAROTE", 2, 10);
    allSeats.push(
      ...rockD1PistaSeats,
      ...rockD1CamaroteSeats,
      ...rockD2PistaSeats,
      ...rockD2CamaroteSeats,
    );

    // ── Evento 2: Sertanejo ao Vivo (PUBLISHED, 1 dia) ─────────────────
    const sertanejoId = randomUUID();
    const sertanejoDayId = randomUUID();
    const sertanejoSessionId = randomUUID();

    await prisma.event.create({
      data: {
        id: sertanejoId,
        tenantId: TENANT_ARENA,
        name: "Sertanejo ao Vivo",
        slug: "sertanejo-ao-vivo",
        description:
          "Uma noite especial com os maiores nomes do sertanejo brasileiro! " +
          "Shows ao vivo, praça de alimentação completa e estacionamento gratuito. " +
          "Traga a família e os amigos para curtir o melhor do sertanejo.",
        status: EventStatus.PUBLISHED,
      },
    });

    await prisma.eventDay.create({
      data: {
        id: sertanejoDayId,
        tenantId: TENANT_ARENA,
        eventId: sertanejoId,
        date: dateOnly(30),
      },
    });

    const sertanejoStart = daysFromNow(30, 20, 0);
    await prisma.session.create({
      data: {
        id: sertanejoSessionId,
        tenantId: TENANT_ARENA,
        eventId: sertanejoId,
        eventDayId: sertanejoDayId,
        name: "Área Geral",
        startsAt: sertanejoStart,
        endsAt: hoursAfter(sertanejoStart, 4),
        salesStartsAt: daysFromNow(-14),
        salesEndsAt: daysFromNow(30, 18),
        priceCents: 15000,
        capacity: 40,
        status: SessionStatus.PUBLISHED,
      },
    });

    const sertanejoSeats = makeSeats(TENANT_ARENA, sertanejoSessionId, "GERAL", 4, 10);
    allSeats.push(...sertanejoSeats);

    // ── Evento 3: Festival Eletrônica (DRAFT, 1 dia) ────────────────────
    const eletronicaId = randomUUID();
    const eletronicaDayId = randomUUID();
    const eletronicaSessionId = randomUUID();

    await prisma.event.create({
      data: {
        id: eletronicaId,
        tenantId: TENANT_ARENA,
        name: "Festival Eletrônica 2026",
        slug: "festival-eletronica-2026",
        description:
          "O festival de música eletrônica mais esperado do ano! DJs internacionais, " +
          "iluminação de última geração e experiência imersiva. Em breve mais informações.",
        status: EventStatus.DRAFT,
      },
    });

    await prisma.eventDay.create({
      data: {
        id: eletronicaDayId,
        tenantId: TENANT_ARENA,
        eventId: eletronicaId,
        date: dateOnly(60),
      },
    });

    const eletronicaStart = daysFromNow(60, 22, 0);
    await prisma.session.create({
      data: {
        id: eletronicaSessionId,
        tenantId: TENANT_ARENA,
        eventId: eletronicaId,
        eventDayId: eletronicaDayId,
        name: "Pista",
        startsAt: eletronicaStart,
        endsAt: hoursAfter(eletronicaStart, 6),
        priceCents: 20000,
        capacity: 50,
        status: SessionStatus.DRAFT,
      },
    });

    const eletronicaSeats = makeSeats(TENANT_ARENA, eletronicaSessionId, "PISTA", 5, 10);
    allSeats.push(...eletronicaSeats);

    // ── Evento 4: Réveillon Arena (PUBLISHED, 1 dia, 2 sessões) ────────
    const reveillonId = randomUUID();
    const reveillonDayId = randomUUID();
    const reveillonOpenBarId = randomUUID();
    const reveillonPistaId = randomUUID();

    await prisma.event.create({
      data: {
        id: reveillonId,
        tenantId: TENANT_ARENA,
        name: "Réveillon Arena 2027",
        slug: "reveillon-arena-2027",
        description:
          "Celebre a virada do ano na Arena Shows! Duas opções exclusivas: " +
          "Open Bar Premium com bebidas ilimitadas e DJ set especial, ou Pista " +
          "com os melhores shows ao vivo. Queima de fogos à meia-noite!",
        status: EventStatus.PUBLISHED,
      },
    });

    await prisma.eventDay.create({
      data: {
        id: reveillonDayId,
        tenantId: TENANT_ARENA,
        eventId: reveillonId,
        date: dateOnly(45),
      },
    });

    const reveillonOpenBarStart = daysFromNow(45, 21, 0);
    const reveillonPistaStart = daysFromNow(45, 22, 0);
    await prisma.session.createMany({
      data: [
        {
          id: reveillonOpenBarId,
          tenantId: TENANT_ARENA,
          eventId: reveillonId,
          eventDayId: reveillonDayId,
          name: "Open Bar Premium",
          startsAt: reveillonOpenBarStart,
          endsAt: hoursAfter(reveillonOpenBarStart, 6),
          salesStartsAt: daysFromNow(-30),
          salesEndsAt: daysFromNow(45, 20),
          priceCents: 80000,
          capacity: 20,
          status: SessionStatus.PUBLISHED,
        },
        {
          id: reveillonPistaId,
          tenantId: TENANT_ARENA,
          eventId: reveillonId,
          eventDayId: reveillonDayId,
          name: "Pista",
          startsAt: reveillonPistaStart,
          endsAt: hoursAfter(reveillonPistaStart, 5),
          salesStartsAt: daysFromNow(-30),
          salesEndsAt: daysFromNow(45, 20),
          priceCents: 40000,
          capacity: 30,
          status: SessionStatus.PUBLISHED,
        },
      ],
    });

    const reveillonOpenBarSeats = makeSeats(TENANT_ARENA, reveillonOpenBarId, "OPENBAR", 2, 10);
    const reveillonPistaSeats = makeSeats(TENANT_ARENA, reveillonPistaId, "PISTA", 3, 10);
    allSeats.push(...reveillonOpenBarSeats, ...reveillonPistaSeats);

    // ── Evento 5: Pagode na Arena (ARCHIVED) ────────────────────────────
    const pagodeId = randomUUID();
    const pagodeDayId = randomUUID();
    const pagodeSessionId = randomUUID();

    await prisma.event.create({
      data: {
        id: pagodeId,
        tenantId: TENANT_ARENA,
        name: "Pagode na Arena",
        slug: "pagode-na-arena",
        description: "Evento encerrado. O pagode mais animado da cidade aconteceu em janeiro de 2026.",
        status: EventStatus.ARCHIVED,
      },
    });

    await prisma.eventDay.create({
      data: {
        id: pagodeDayId,
        tenantId: TENANT_ARENA,
        eventId: pagodeId,
        date: dateOnly(-30),
      },
    });

    const pagodeStart = daysFromNow(-30, 18, 0);
    await prisma.session.create({
      data: {
        id: pagodeSessionId,
        tenantId: TENANT_ARENA,
        eventId: pagodeId,
        eventDayId: pagodeDayId,
        name: "Área Geral",
        startsAt: pagodeStart,
        endsAt: hoursAfter(pagodeStart, 5),
        priceCents: 12000,
        capacity: 30,
        status: SessionStatus.PUBLISHED,
      },
    });

    const pagodeSeats = makeSeats(TENANT_ARENA, pagodeSessionId, "GERAL", 3, 10);
    allSeats.push(...pagodeSeats);

    // ══════════════════════════════════════════════════════════════════════
    //  TEATRO SÃO PAULO — Eventos
    // ══════════════════════════════════════════════════════════════════════
    console.log("Criando eventos Teatro Sao Paulo...");

    // ── Evento 1: O Fantasma da Ópera (PUBLISHED, 3 dias) ──────────────
    const fantasmaId = randomUUID();
    const fantasmaDay1Id = randomUUID();
    const fantasmaDay2Id = randomUUID();
    const fantasmaDay3Id = randomUUID();
    const fantasmaD1PlateiaId = randomUUID();
    const fantasmaD1MezaninoId = randomUUID();
    const fantasmaD2PlateiaId = randomUUID();
    const fantasmaD2MezaninoId = randomUUID();
    const fantasmaD3PlateiaId = randomUUID();
    const fantasmaD3MezaninoId = randomUUID();

    await prisma.event.create({
      data: {
        id: fantasmaId,
        tenantId: TENANT_TEATRO,
        name: "O Fantasma da Ópera",
        slug: "o-fantasma-da-opera",
        description:
          "O clássico musical da Broadway chega ao Teatro São Paulo em uma " +
          "produção grandiosa! Com cenários deslumbrantes, figurinos originais " +
          "e um elenco premiado, viva a história de amor e mistério que " +
          "encantou milhões ao redor do mundo.",
        status: EventStatus.PUBLISHED,
      },
    });

    await prisma.eventDay.createMany({
      data: [
        { id: fantasmaDay1Id, tenantId: TENANT_TEATRO, eventId: fantasmaId, date: dateOnly(10) },
        { id: fantasmaDay2Id, tenantId: TENANT_TEATRO, eventId: fantasmaId, date: dateOnly(11) },
        { id: fantasmaDay3Id, tenantId: TENANT_TEATRO, eventId: fantasmaId, date: dateOnly(12) },
      ],
    });

    const createFantasmaSessions = (dayId: string, dayOffset: number) => {
      const plateiaId = dayOffset === 10 ? fantasmaD1PlateiaId :
                        dayOffset === 11 ? fantasmaD2PlateiaId : fantasmaD3PlateiaId;
      const mezaninoId = dayOffset === 10 ? fantasmaD1MezaninoId :
                         dayOffset === 11 ? fantasmaD2MezaninoId : fantasmaD3MezaninoId;
      const plateiaStart = daysFromNow(dayOffset, 20, 0);
      const mezaninoStart = daysFromNow(dayOffset, 19, 30); // abre portas antes
      return [
        {
          id: plateiaId,
          tenantId: TENANT_TEATRO,
          eventId: fantasmaId,
          eventDayId: dayId,
          name: `Plateia`,
          startsAt: plateiaStart,
          endsAt: hoursAfter(plateiaStart, 3),
          salesStartsAt: daysFromNow(-21),
          salesEndsAt: daysFromNow(dayOffset, 19),
          priceCents: 30000,
          capacity: 20,
          status: SessionStatus.PUBLISHED,
        },
        {
          id: mezaninoId,
          tenantId: TENANT_TEATRO,
          eventId: fantasmaId,
          eventDayId: dayId,
          name: `Mezanino`,
          startsAt: mezaninoStart,
          endsAt: hoursAfter(mezaninoStart, 3),
          salesStartsAt: daysFromNow(-21),
          salesEndsAt: daysFromNow(dayOffset, 19),
          priceCents: 18000,
          capacity: 15,
          status: SessionStatus.PUBLISHED,
        },
      ];
    };

    await prisma.session.createMany({
      data: [
        ...createFantasmaSessions(fantasmaDay1Id, 10),
        ...createFantasmaSessions(fantasmaDay2Id, 11),
        ...createFantasmaSessions(fantasmaDay3Id, 12),
      ],
    });

    const fantasmaD1PlateiaSeats = makeSeats(TENANT_TEATRO, fantasmaD1PlateiaId, "PLATEIA", 2, 10);
    const fantasmaD1MezaninoSeats = makeSeats(TENANT_TEATRO, fantasmaD1MezaninoId, "MEZANINO", 3, 5);
    const fantasmaD2PlateiaSeats = makeSeats(TENANT_TEATRO, fantasmaD2PlateiaId, "PLATEIA", 2, 10);
    const fantasmaD2MezaninoSeats = makeSeats(TENANT_TEATRO, fantasmaD2MezaninoId, "MEZANINO", 3, 5);
    const fantasmaD3PlateiaSeats = makeSeats(TENANT_TEATRO, fantasmaD3PlateiaId, "PLATEIA", 2, 10);
    const fantasmaD3MezaninoSeats = makeSeats(TENANT_TEATRO, fantasmaD3MezaninoId, "MEZANINO", 3, 5);
    allSeats.push(
      ...fantasmaD1PlateiaSeats,
      ...fantasmaD1MezaninoSeats,
      ...fantasmaD2PlateiaSeats,
      ...fantasmaD2MezaninoSeats,
      ...fantasmaD3PlateiaSeats,
      ...fantasmaD3MezaninoSeats,
    );

    // ── Evento 2: Stand-Up Comedy Night (PUBLISHED, 1 dia) ─────────────
    const standupId = randomUUID();
    const standupDayId = randomUUID();
    const standupSessionId = randomUUID();

    await prisma.event.create({
      data: {
        id: standupId,
        tenantId: TENANT_TEATRO,
        name: "Stand-Up Comedy Night",
        slug: "stand-up-comedy-night",
        description:
          "Uma noite de muitas risadas com os comediantes mais engraçados do país! " +
          "Formato intimista no Teatro São Paulo, com bar e petiscos disponíveis. " +
          "Classificação: 16 anos.",
        status: EventStatus.PUBLISHED,
      },
    });

    await prisma.eventDay.create({
      data: {
        id: standupDayId,
        tenantId: TENANT_TEATRO,
        eventId: standupId,
        date: dateOnly(20),
      },
    });

    const standupStart = daysFromNow(20, 21, 0);
    await prisma.session.create({
      data: {
        id: standupSessionId,
        tenantId: TENANT_TEATRO,
        eventId: standupId,
        eventDayId: standupDayId,
        name: "Plateia Geral",
        startsAt: standupStart,
        endsAt: hoursAfter(standupStart, 2),
        salesStartsAt: daysFromNow(-10),
        salesEndsAt: daysFromNow(20, 20),
        priceCents: 8000,
        capacity: 50,
        status: SessionStatus.PUBLISHED,
      },
    });

    const standupSeats = makeSeats(TENANT_TEATRO, standupSessionId, "GERAL", 5, 10);
    allSeats.push(...standupSeats);

    // ── Evento 3: Hamilton — O Musical (PUBLISHED, 2 dias) ──────────────
    const hamiltonId = randomUUID();
    const hamiltonDay1Id = randomUUID();
    const hamiltonDay2Id = randomUUID();
    const hamiltonD1SessionId = randomUUID();
    const hamiltonD2SessionId = randomUUID();

    await prisma.event.create({
      data: {
        id: hamiltonId,
        tenantId: TENANT_TEATRO,
        name: "Hamilton — O Musical",
        slug: "hamilton-o-musical",
        description:
          "A aclamada produção brasileira de Hamilton chega ao Teatro São Paulo! " +
          "A história do pai fundador Alexander Hamilton contada através de hip-hop, " +
          "jazz, R&B e Broadway. Uma experiência teatral revolucionária.",
        status: EventStatus.PUBLISHED,
      },
    });

    await prisma.eventDay.createMany({
      data: [
        { id: hamiltonDay1Id, tenantId: TENANT_TEATRO, eventId: hamiltonId, date: dateOnly(25) },
        { id: hamiltonDay2Id, tenantId: TENANT_TEATRO, eventId: hamiltonId, date: dateOnly(26) },
      ],
    });

    const hamiltonD1Start = daysFromNow(25, 20, 0);
    const hamiltonD2Start = daysFromNow(26, 20, 0);
    await prisma.session.createMany({
      data: [
        {
          id: hamiltonD1SessionId,
          tenantId: TENANT_TEATRO,
          eventId: hamiltonId,
          eventDayId: hamiltonDay1Id,
          name: "Plateia",
          startsAt: hamiltonD1Start,
          endsAt: hoursAfter(hamiltonD1Start, 3),
          salesStartsAt: daysFromNow(-14),
          salesEndsAt: daysFromNow(25, 19),
          priceCents: 35000,
          capacity: 30,
          status: SessionStatus.PUBLISHED,
        },
        {
          id: hamiltonD2SessionId,
          tenantId: TENANT_TEATRO,
          eventId: hamiltonId,
          eventDayId: hamiltonDay2Id,
          name: "Plateia",
          startsAt: hamiltonD2Start,
          endsAt: hoursAfter(hamiltonD2Start, 3),
          salesStartsAt: daysFromNow(-14),
          salesEndsAt: daysFromNow(26, 19),
          priceCents: 35000,
          capacity: 30,
          status: SessionStatus.PUBLISHED,
        },
      ],
    });

    const hamiltonD1Seats = makeSeats(TENANT_TEATRO, hamiltonD1SessionId, "PLATEIA", 3, 10);
    const hamiltonD2Seats = makeSeats(TENANT_TEATRO, hamiltonD2SessionId, "PLATEIA", 3, 10);
    allSeats.push(...hamiltonD1Seats, ...hamiltonD2Seats);

    // ── Evento 4: Ballet — Lago dos Cisnes (DRAFT) ─────────────────────
    const balletId = randomUUID();
    const balletDay1Id = randomUUID();
    const balletDay2Id = randomUUID();
    const balletD1SessionId = randomUUID();
    const balletD2SessionId = randomUUID();

    await prisma.event.create({
      data: {
        id: balletId,
        tenantId: TENANT_TEATRO,
        name: "Ballet — Lago dos Cisnes",
        slug: "ballet-lago-dos-cisnes",
        description:
          "O espetáculo de ballet mais famoso do mundo, com coreografia original " +
          "de Tchaikovsky. Produção em parceria com companhia internacional. " +
          "Em breve, abertura de vendas.",
        status: EventStatus.DRAFT,
      },
    });

    await prisma.eventDay.createMany({
      data: [
        { id: balletDay1Id, tenantId: TENANT_TEATRO, eventId: balletId, date: dateOnly(50) },
        { id: balletDay2Id, tenantId: TENANT_TEATRO, eventId: balletId, date: dateOnly(51) },
      ],
    });

    const balletD1Start = daysFromNow(50, 20, 0);
    const balletD2Start = daysFromNow(51, 20, 0);
    await prisma.session.createMany({
      data: [
        {
          id: balletD1SessionId,
          tenantId: TENANT_TEATRO,
          eventId: balletId,
          eventDayId: balletDay1Id,
          name: "Plateia",
          startsAt: balletD1Start,
          endsAt: hoursAfter(balletD1Start, 3),
          priceCents: 35000,
          capacity: 20,
          status: SessionStatus.DRAFT,
        },
        {
          id: balletD2SessionId,
          tenantId: TENANT_TEATRO,
          eventId: balletId,
          eventDayId: balletDay2Id,
          name: "Plateia",
          startsAt: balletD2Start,
          endsAt: hoursAfter(balletD2Start, 3),
          priceCents: 35000,
          capacity: 20,
          status: SessionStatus.DRAFT,
        },
      ],
    });

    const balletD1Seats = makeSeats(TENANT_TEATRO, balletD1SessionId, "PLATEIA", 2, 10);
    const balletD2Seats = makeSeats(TENANT_TEATRO, balletD2SessionId, "PLATEIA", 2, 10);
    allSeats.push(...balletD1Seats, ...balletD2Seats);

    // ══════════════════════════════════════════════════════════════════════
    //  Bulk insert de todos os assentos
    // ══════════════════════════════════════════════════════════════════════
    console.log(`Criando ${allSeats.length} assentos...`);
    await prisma.sessionSeat.createMany({ data: allSeats });

    // ══════════════════════════════════════════════════════════════════════
    //  Pedidos e Ingressos
    // ══════════════════════════════════════════════════════════════════════
    console.log("Criando pedidos e ingressos...");

    const arenaFee = { policyVersion: "arena_v1", feePercentBps: 500, feeFixedCents: 200 };
    const teatroFee = { policyVersion: "teatro_v1", feePercentBps: 800, feeFixedCents: 300 };

    // ── Rock in Arena — Dia 1 — Pista ───────────────────────────────────
    // Pedido 1: João Silva — 2 ingressos (PAGO)
    await createFullOrder(prisma, {
      tenantId: TENANT_ARENA,
      sessionId: rockD1PistaId,
      seats: rockD1PistaSeats.slice(0, 2), // A1, A2
      priceCents: 25000,
      buyer: { name: "João Silva", email: "joao.silva@email.com", document: "123.456.789-00" },
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      ...arenaFee,
    });

    // Pedido 2: Maria Oliveira — 3 ingressos (PAGO)
    await createFullOrder(prisma, {
      tenantId: TENANT_ARENA,
      sessionId: rockD1PistaId,
      seats: rockD1PistaSeats.slice(2, 5), // A3, A4, A5
      priceCents: 25000,
      buyer: { name: "Maria Oliveira", email: "maria.oliveira@email.com", document: "987.654.321-00" },
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      paymentMethod: PaymentMethod.PIX,
      ...arenaFee,
    });

    // Pedido 3: Pedro Santos — 1 ingresso (PENDENTE)
    await createFullOrder(prisma, {
      tenantId: TENANT_ARENA,
      sessionId: rockD1PistaId,
      seats: rockD1PistaSeats.slice(10, 11), // B1
      priceCents: 25000,
      buyer: { name: "Pedro Santos", email: "pedro.santos@email.com" },
      orderStatus: OrderStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.PIX,
      ...arenaFee,
    });

    // ── Rock in Arena — Dia 1 — Camarote ────────────────────────────────
    // Pedido 4: Ana Costa — 2 ingressos (PAGO)
    await createFullOrder(prisma, {
      tenantId: TENANT_ARENA,
      sessionId: rockD1CamaroteId,
      seats: rockD1CamaroteSeats.slice(0, 2), // A1, A2
      priceCents: 50000,
      buyer: { name: "Ana Costa", email: "ana.costa@email.com", document: "111.222.333-44" },
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      ...arenaFee,
    });

    // ── Rock in Arena — Dia 2 — Pista ───────────────────────────────────
    // Pedido 5: Carlos Mendes — 4 ingressos (PAGO)
    await createFullOrder(prisma, {
      tenantId: TENANT_ARENA,
      sessionId: rockD2PistaId,
      seats: rockD2PistaSeats.slice(0, 4), // A1-A4
      priceCents: 25000,
      buyer: { name: "Carlos Mendes", email: "carlos.mendes@email.com", document: "555.666.777-88" },
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      ...arenaFee,
    });

    // ── Sertanejo ao Vivo ───────────────────────────────────────────────
    // Pedido 6: Lucas Ferreira — 4 ingressos (PAGO)
    await createFullOrder(prisma, {
      tenantId: TENANT_ARENA,
      sessionId: sertanejoSessionId,
      seats: sertanejoSeats.slice(0, 4), // A1-A4
      priceCents: 15000,
      buyer: { name: "Lucas Ferreira", email: "lucas.ferreira@email.com", document: "222.333.444-55" },
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      paymentMethod: PaymentMethod.PIX,
      ...arenaFee,
    });

    // Pedido 7: Juliana Mendes — 2 ingressos (PAGO)
    await createFullOrder(prisma, {
      tenantId: TENANT_ARENA,
      sessionId: sertanejoSessionId,
      seats: sertanejoSeats.slice(10, 12), // B1, B2
      priceCents: 15000,
      buyer: { name: "Juliana Mendes", email: "juliana.mendes@email.com" },
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      ...arenaFee,
    });

    // ── Réveillon — Open Bar ────────────────────────────────────────────
    // Pedido 8: Rafael Almeida — 2 ingressos (PAGO)
    await createFullOrder(prisma, {
      tenantId: TENANT_ARENA,
      sessionId: reveillonOpenBarId,
      seats: reveillonOpenBarSeats.slice(0, 2), // A1, A2
      priceCents: 80000,
      buyer: { name: "Rafael Almeida", email: "rafael.almeida@email.com", document: "333.444.555-66" },
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      ...arenaFee,
    });

    // ── Fantasma da Ópera — Dia 1 — Plateia ────────────────────────────
    // Pedido 9: Camila Rocha — 2 ingressos (PAGO)
    await createFullOrder(prisma, {
      tenantId: TENANT_TEATRO,
      sessionId: fantasmaD1PlateiaId,
      seats: fantasmaD1PlateiaSeats.slice(0, 2), // A1, A2
      priceCents: 30000,
      buyer: { name: "Camila Rocha", email: "camila.rocha@email.com", document: "444.555.666-77" },
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      paymentMethod: PaymentMethod.PIX,
      ...teatroFee,
    });

    // Pedido 10: Bruno Lima — 4 ingressos (PAGO)
    await createFullOrder(prisma, {
      tenantId: TENANT_TEATRO,
      sessionId: fantasmaD1PlateiaId,
      seats: fantasmaD1PlateiaSeats.slice(2, 6), // A3-A6
      priceCents: 30000,
      buyer: { name: "Bruno Lima", email: "bruno.lima@email.com", document: "666.777.888-99" },
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      ...teatroFee,
    });

    // Pedido 11: Fernanda Souza — 2 ingressos (EXPIRADO)
    await createFullOrder(prisma, {
      tenantId: TENANT_TEATRO,
      sessionId: fantasmaD1PlateiaId,
      seats: fantasmaD1PlateiaSeats.slice(10, 12), // B1, B2
      priceCents: 30000,
      buyer: { name: "Fernanda Souza", email: "fernanda.souza@email.com" },
      orderStatus: OrderStatus.EXPIRED,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.PIX,
      ...teatroFee,
    });

    // ── Fantasma da Ópera — Dia 1 — Mezanino ───────────────────────────
    // Pedido 12: Diego Martins — 3 ingressos (PAGO)
    await createFullOrder(prisma, {
      tenantId: TENANT_TEATRO,
      sessionId: fantasmaD1MezaninoId,
      seats: fantasmaD1MezaninoSeats.slice(0, 3), // A1, A2, A3
      priceCents: 18000,
      buyer: { name: "Diego Martins", email: "diego.martins@email.com", document: "777.888.999-00" },
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      paymentMethod: PaymentMethod.DEBIT_CARD,
      ...teatroFee,
    });

    // ── Stand-Up Comedy Night ───────────────────────────────────────────
    // Pedido 13: Gabriela Nunes — 2 ingressos (PAGO)
    await createFullOrder(prisma, {
      tenantId: TENANT_TEATRO,
      sessionId: standupSessionId,
      seats: standupSeats.slice(0, 2), // A1, A2
      priceCents: 8000,
      buyer: { name: "Gabriela Nunes", email: "gabriela.nunes@email.com" },
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      paymentMethod: PaymentMethod.PIX,
      ...teatroFee,
    });

    // Pedido 14: Thiago Ribeiro — 5 ingressos (PAGO)
    await createFullOrder(prisma, {
      tenantId: TENANT_TEATRO,
      sessionId: standupSessionId,
      seats: standupSeats.slice(10, 15), // B1-B5
      priceCents: 8000,
      buyer: { name: "Thiago Ribeiro", email: "thiago.ribeiro@email.com", document: "888.999.000-11" },
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      ...teatroFee,
    });

    // ── Hamilton — Dia 1 ────────────────────────────────────────────────
    // Pedido 15: Letícia Campos — 2 ingressos (PAGO)
    await createFullOrder(prisma, {
      tenantId: TENANT_TEATRO,
      sessionId: hamiltonD1SessionId,
      seats: hamiltonD1Seats.slice(0, 2), // A1, A2
      priceCents: 35000,
      buyer: { name: "Letícia Campos", email: "leticia.campos@email.com", document: "999.000.111-22" },
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      ...teatroFee,
    });

    // Pedido 16: Ricardo Moreira — 3 ingressos (PENDENTE)
    await createFullOrder(prisma, {
      tenantId: TENANT_TEATRO,
      sessionId: hamiltonD1SessionId,
      seats: hamiltonD1Seats.slice(10, 13), // B1, B2, B3
      priceCents: 35000,
      buyer: { name: "Ricardo Moreira", email: "ricardo.moreira@email.com" },
      orderStatus: OrderStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.PIX,
      ...teatroFee,
    });

    // ══════════════════════════════════════════════════════════════════════
    //  Resumo
    // ══════════════════════════════════════════════════════════════════════
    const tenantCount = await prisma.tenant.count();
    const eventCount = await prisma.event.count();
    const sessionCount = await prisma.session.count();
    const seatCount = await prisma.sessionSeat.count();
    const orderCount = await prisma.order.count();
    const ticketCount = await prisma.ticket.count();

    console.log("\n=== Seed concluido ===");
    console.log(`  Tenants:  ${tenantCount}`);
    console.log(`  Eventos:  ${eventCount}`);
    console.log(`  Sessoes:  ${sessionCount}`);
    console.log(`  Assentos: ${seatCount}`);
    console.log(`  Pedidos:  ${orderCount}`);
    console.log(`  Tickets:  ${ticketCount}`);
    console.log("");
    console.log("Tenants criados:");
    console.log(`  Arena Shows      → slug: arena-shows      | id: ${TENANT_ARENA}`);
    console.log(`  Teatro Sao Paulo → slug: teatro-sao-paulo | id: ${TENANT_TEATRO}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Erro ao executar seed:", err);
  process.exit(1);
});

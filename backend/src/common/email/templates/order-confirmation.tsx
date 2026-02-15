import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text
} from "@react-email/components";
import * as React from "react";

type TicketInfo = {
  qrCode: string;
  sessionName: string;
  seatSector: string;
  seatRow: string;
  seatNumber: number;
};

export type TenantBranding = {
  tenantName: string;
  logoUrl?: string | null;
  primaryColor: string;
  footerText?: string | null;
  termsUrl?: string | null;
  privacyUrl?: string | null;
};

type OrderConfirmationProps = {
  buyerName: string;
  orderId: string;
  sessionName: string;
  ticketSubtotalCents: number;
  serviceFeeCents: number;
  totalAmountCents: number;
  currencyCode: string;
  orderAccessUrl?: string;
  tickets: TicketInfo[];
  branding?: TenantBranding;
  isAccessLink?: boolean;
};

function formatCurrency(cents: number, currencyCode: string): string {
  const value = cents / 100;

  if (currencyCode === "BRL") {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }

  return `${currencyCode} ${value.toFixed(2)}`;
}

export function OrderConfirmationEmail(props: OrderConfirmationProps) {
  const {
    buyerName = "",
    orderId = "",
    sessionName = "",
    ticketSubtotalCents = 0,
    serviceFeeCents = 0,
    totalAmountCents = 0,
    currencyCode = "BRL",
    orderAccessUrl,
    tickets = [],
    branding,
    isAccessLink = false
  } = props;

  const brandColor = branding?.primaryColor ?? "#1a1a1a";
  const brandHeadingStyle: React.CSSProperties = { ...headingStyle, color: brandColor };

  return (
    <Html>
      <Head />
      <Preview>
        Confirmacao de compra{branding?.tenantName ? ` - ${branding.tenantName}` : ""} - {sessionName}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {branding?.logoUrl && (
            <Section style={logoSectionStyle}>
              <Img
                src={branding.logoUrl}
                width={160}
                height={48}
                alt={branding.tenantName ?? "Logo"}
                style={logoStyle}
              />
            </Section>
          )}
          <Heading style={brandHeadingStyle}>
            {isAccessLink ? "Acesso ao seu pedido" : "Compra confirmada!"}
          </Heading>
          <Text style={textStyle}>Ola, {buyerName}!</Text>
          {isAccessLink ? (
            <Text style={textStyle}>
              Voce solicitou acesso ao seu pedido. Clique no botao abaixo para visualizar seus
              ingressos e detalhes da compra.
            </Text>
          ) : (
            <Text style={textStyle}>
              Sua compra foi confirmada com sucesso. Abaixo estao os detalhes do seu pedido e os
              ingressos.
            </Text>
          )}

          {!isAccessLink && (
            <Section style={sectionStyle}>
              <Heading as="h2" style={subheadingStyle}>
                Resumo do pedido
              </Heading>
              <Text style={detailStyle}>Pedido: {orderId}</Text>
              <Text style={detailStyle}>Sessao: {sessionName}</Text>
              <Hr style={hrStyle} />
              <Row>
                <Column>
                  <Text style={detailStyle}>Subtotal ingressos</Text>
                </Column>
                <Column align="right">
                  <Text style={detailStyle}>
                    {formatCurrency(ticketSubtotalCents, currencyCode)}
                  </Text>
                </Column>
              </Row>
              <Row>
                <Column>
                  <Text style={detailStyle}>Taxa de servico</Text>
                </Column>
                <Column align="right">
                  <Text style={detailStyle}>{formatCurrency(serviceFeeCents, currencyCode)}</Text>
                </Column>
              </Row>
              <Hr style={hrStyle} />
              <Row>
                <Column>
                  <Text style={totalStyle}>Total</Text>
                </Column>
                <Column align="right">
                  <Text style={totalStyle}>{formatCurrency(totalAmountCents, currencyCode)}</Text>
                </Column>
              </Row>
            </Section>
          )}

          {!isAccessLink && tickets.length > 0 && (
            <Section style={sectionStyle}>
              <Heading as="h2" style={subheadingStyle}>
                Seus ingressos
              </Heading>
              {tickets.map((ticket) => (
                <Section key={ticket.qrCode} style={ticketCardStyle}>
                  <Row>
                    <Column style={ticketInfoColumnStyle}>
                      <Text style={ticketSessionStyle}>{ticket.sessionName}</Text>
                      <Text style={detailStyle}>
                        Setor {ticket.seatSector} | Fileira {ticket.seatRow} | Assento{" "}
                        {ticket.seatNumber}
                      </Text>
                    </Column>
                    <Column style={qrColumnStyle}>
                      <Img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(ticket.qrCode)}`}
                        width={90}
                        height={90}
                        alt={`QR Code do ingresso - ${ticket.seatSector} ${ticket.seatRow}${ticket.seatNumber}`}
                        style={qrImageStyle}
                      />
                    </Column>
                  </Row>
                </Section>
              ))}
            </Section>
          )}

          {isAccessLink && (
            <Section style={sectionStyle}>
              <Text style={detailStyle}>Pedido: {orderId}</Text>
              <Text style={detailStyle}>Sessao: {sessionName}</Text>
            </Section>
          )}

          {orderAccessUrl && (
            <Section style={accessLinkSectionStyle}>
              <Link href={orderAccessUrl} style={accessButtonStyle}>
                {isAccessLink ? "Ver meu pedido" : "Acessar meus ingressos online"}
              </Link>
              <Text style={accessHintStyle}>
                Este link e pessoal e permite acessar seus ingressos a qualquer momento.
              </Text>
            </Section>
          )}

          <Hr style={hrStyle} />
          {branding?.footerText && (
            <Text style={footerStyle}>{branding.footerText}</Text>
          )}
          <Text style={footerStyle}>
            Este e-mail foi enviado automaticamente. Nao responda a esta mensagem.
          </Text>
          {(branding?.termsUrl || branding?.privacyUrl) && (
            <Text style={footerLinksStyle}>
              {branding.termsUrl && (
                <Link href={branding.termsUrl} style={footerLinkStyle}>
                  Termos de uso
                </Link>
              )}
              {branding.termsUrl && branding.privacyUrl && " | "}
              {branding.privacyUrl && (
                <Link href={branding.privacyUrl} style={footerLinkStyle}>
                  Politica de privacidade
                </Link>
              )}
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
};

const containerStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "32px",
  maxWidth: "600px",
  borderRadius: "8px"
};

const logoSectionStyle: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "0 0 24px"
};

const logoStyle: React.CSSProperties = {
  display: "inline-block",
  objectFit: "contain" as const
};

const headingStyle: React.CSSProperties = {
  color: "#1a1a1a",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "0 0 16px"
};

const subheadingStyle: React.CSSProperties = {
  color: "#1a1a1a",
  fontSize: "18px",
  fontWeight: "600",
  margin: "0 0 12px"
};

const textStyle: React.CSSProperties = {
  color: "#4a4a4a",
  fontSize: "14px",
  lineHeight: "24px",
  margin: "0 0 12px"
};

const detailStyle: React.CSSProperties = {
  color: "#4a4a4a",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "4px 0"
};

const totalStyle: React.CSSProperties = {
  color: "#1a1a1a",
  fontSize: "16px",
  fontWeight: "bold",
  margin: "4px 0"
};

const sectionStyle: React.CSSProperties = {
  margin: "24px 0",
  padding: "16px",
  backgroundColor: "#f9fafb",
  borderRadius: "6px"
};

const ticketCardStyle: React.CSSProperties = {
  margin: "12px 0",
  padding: "12px",
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "6px"
};

const ticketSessionStyle: React.CSSProperties = {
  color: "#1a1a1a",
  fontSize: "14px",
  fontWeight: "600",
  margin: "0 0 4px"
};

const ticketInfoColumnStyle: React.CSSProperties = {
  verticalAlign: "middle"
};

const qrColumnStyle: React.CSSProperties = {
  width: "100px",
  verticalAlign: "middle",
  textAlign: "center" as const
};

const qrImageStyle: React.CSSProperties = {
  borderRadius: "4px",
  border: "1px solid #e5e7eb"
};

const accessLinkSectionStyle: React.CSSProperties = {
  margin: "24px 0",
  textAlign: "center" as const
};

const accessButtonStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#1a1a1a",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "bold",
  padding: "14px 32px",
  borderRadius: "6px",
  textDecoration: "none"
};

const accessHintStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  margin: "12px 0 0",
  textAlign: "center" as const
};

const hrStyle: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "16px 0"
};

const footerStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  textAlign: "center" as const,
  margin: "16px 0 0"
};

const footerLinksStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  textAlign: "center" as const,
  margin: "8px 0 0"
};

const footerLinkStyle: React.CSSProperties = {
  color: "#9ca3af",
  textDecoration: "underline"
};

OrderConfirmationEmail.PreviewProps = {
  buyerName: "Joao Silva",
  orderId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  sessionName: "Show Rock in Rio - Palco Mundo",
  ticketSubtotalCents: 45000,
  serviceFeeCents: 4500,
  totalAmountCents: 49500,
  currencyCode: "BRL",
  tickets: [
    {
      qrCode: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      sessionName: "Show Rock in Rio - Palco Mundo",
      seatSector: "VIP",
      seatRow: "A",
      seatNumber: 12
    },
    {
      qrCode: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      sessionName: "Show Rock in Rio - Palco Mundo",
      seatSector: "VIP",
      seatRow: "A",
      seatNumber: 13
    }
  ],
  branding: {
    tenantName: "Acme Eventos",
    logoUrl: "https://placehold.co/320x96/000000/FFFFFF?text=ACME",
    primaryColor: "#6366f1",
    footerText: "Acme Eventos - Sua experiencia, nosso compromisso.",
    termsUrl: "https://acme-eventos.com/termos",
    privacyUrl: "https://acme-eventos.com/privacidade"
  }
} as OrderConfirmationProps;

export default OrderConfirmationEmail;

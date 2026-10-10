import { Document, Font, Image as PdfImage, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatCnpj } from "@/lib/cnpj";
import { formatBRL } from "@/lib/money";
import { formatDateBR } from "@/lib/quote-status";
import type { ProposalData } from "./types";

Font.registerHyphenationCallback((word) => [word]);

const BLUE = "#0f4590";
const DARK = "#0a2a5c";
const GREEN = "#178a4d";
const LIGHT = "#eef5ff";
const GRAY = "#475569";
const LINE = "#d5dde8";

const s = StyleSheet.create({
  page: { paddingTop: 70, paddingBottom: 60, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 10, color: "#1e293b", lineHeight: 1.45 },
  cover: { backgroundColor: DARK, color: "#ffffff", padding: 0, fontFamily: "Helvetica" },
  coverBand: { position: "absolute", left: 0, right: 0, bottom: 0, height: 14, backgroundColor: GREEN },
  coverSide: { position: "absolute", top: 0, bottom: 0, left: 0, width: 14, backgroundColor: GREEN },
  coverBody: { flex: 1, paddingHorizontal: 64, paddingTop: 90, paddingBottom: 60 },
  brand: { fontSize: 30, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  brandAccent: { color: "#5bd68f" },
  brandSub: { fontSize: 9, letterSpacing: 2, color: "#bcd3f5", marginTop: 4 },
  coverTitle: { marginTop: 150, fontSize: 34, fontFamily: "Helvetica-Bold", lineHeight: 1.15 },
  coverRule: { width: 70, height: 4, backgroundColor: "#5bd68f", marginTop: 18, marginBottom: 18 },
  coverLabel: { fontSize: 9, color: "#bcd3f5", letterSpacing: 1.5, marginTop: 18 },
  coverValue: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 3 },
  coverFooter: { position: "absolute", left: 64, right: 64, bottom: 46, fontSize: 9, color: "#bcd3f5" },
  header: { position: "absolute", top: 24, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 2, borderBottomColor: GREEN, paddingBottom: 6 },
  headerBrand: { fontFamily: "Helvetica-Bold", fontSize: 13, color: BLUE },
  headerRef: { fontSize: 8.5, color: GRAY },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: GRAY, borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 6 },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 8, marginTop: 4 },
  h1Bar: { width: 40, height: 3, backgroundColor: GREEN, marginBottom: 12 },
  h2: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: DARK, marginTop: 12, marginBottom: 3 },
  h3: { fontSize: 9, fontFamily: "Helvetica-Bold", color: GREEN, marginTop: 6, marginBottom: 2, textTransform: "uppercase" },
  p: { marginBottom: 6, textAlign: "justify" },
  box: { backgroundColor: LIGHT, borderLeftWidth: 3, borderLeftColor: BLUE, padding: 10, marginBottom: 10 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 5 },
  rowLabel: { width: 130, fontFamily: "Helvetica-Bold", color: BLUE, fontSize: 9 },
  rowValue: { flex: 1 },
  tHead: { flexDirection: "row", backgroundColor: BLUE, color: "#ffffff", paddingVertical: 6, paddingHorizontal: 6, fontFamily: "Helvetica-Bold", fontSize: 9 },
  tRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: LINE },
  tRowAlt: { backgroundColor: "#f6f9fd" },
  cDesc: { flex: 1 },
  cQty: { width: 48, textAlign: "right" },
  cUnit: { width: 76, textAlign: "right" },
  cDisc: { width: 46, textAlign: "right" },
  cTotal: { width: 80, textAlign: "right" },
  totalsBox: { marginTop: 10, alignSelf: "flex-end", width: 250 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: { flexDirection: "row", justifyContent: "space-between", backgroundColor: GREEN, color: "#ffffff", padding: 8, marginTop: 4, fontFamily: "Helvetica-Bold", fontSize: 12 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 12, color: GREEN },
  sign: { flexDirection: "row", gap: 30, marginTop: 50 },
  signBox: { flex: 1, borderTopWidth: 1, borderTopColor: "#1e293b", paddingTop: 4, fontSize: 9 },
  watermark: { position: "absolute", top: 380, left: 0, right: 0, textAlign: "center", fontSize: 40, fontFamily: "Helvetica-Bold", color: "#dc2626", opacity: 0.12, transform: "rotate(-30deg)" },
});

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean);

const lines = (text: string) =>
  text
    .split("\n")
    .map((t) => t.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {paragraphs(text).map((t, i) => (
        <Text key={i} style={s.p}>{t}</Text>
      ))}
    </>
  );
}

function Bullets({ text }: { text: string }) {
  return (
    <>
      {lines(text).map((t, i) => (
        <View key={i} style={s.bullet} wrap={false}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={{ flex: 1 }}>{t}</Text>
        </View>
      ))}
    </>
  );
}

function Section({ title, children, newPage }: { title: string; children: React.ReactNode; newPage?: boolean }) {
  return (
    <View break={newPage} style={{ marginBottom: 16 }}>
      <Text style={s.h1} minPresenceAhead={80}>{title}</Text>
      <View style={s.h1Bar} />
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={s.row} wrap={false}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const qty = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function ProposalDocument({ data, logo }: { data: ProposalData; logo?: Buffer | null }) {
  const ref = `Proposta ${data.number}/${data.version}`;
  const hasDiscount = data.discountCents > 0;
  const specificClauses = data.items.filter((i) => i.specific_clauses.trim());

  return (
    <Document title={`${ref} - ${data.client.razao_social}`} author={data.company.name} subject="Proposta comercial">
      <Page size="A4" style={s.cover}>
        <View style={s.coverSide} fixed={false} />
        <View style={s.coverBody}>
          {logo ? (
            <PdfImage src={logo} style={{ height: 50, objectFit: "contain", objectPositionX: 0 }} />
          ) : (
            <>
              <Text style={s.brand}>Super<Text style={s.brandAccent}>Seg</Text></Text>
              <Text style={s.brandSub}>MEDICINA E SEGURANÇA DO TRABALHO</Text>
            </>
          )}
          <Text style={s.coverTitle}>Proposta{"\n"}Comercial</Text>
          <View style={s.coverRule} />
          <Text style={s.coverLabel}>PROPOSTA Nº</Text>
          <Text style={s.coverValue}>{data.number}/{data.version}</Text>
          <Text style={s.coverLabel}>PREPARADA PARA</Text>
          <Text style={s.coverValue}>{data.client.razao_social}</Text>
          <Text style={s.coverLabel}>DATA DE EMISSÃO · VALIDADE</Text>
          <Text style={s.coverValue}>{formatDateBR(data.issuedAt)} · até {formatDateBR(data.validityDate)}</Text>
        </View>
        <View style={s.coverFooter}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.company.name}</Text>
          <Text>{[data.company.phone, data.company.email, data.company.site].filter(Boolean).join("   ·   ")}</Text>
        </View>
        <View style={s.coverBand} />
        {data.draft && <Text style={[s.watermark, { color: "#ffffff", opacity: 0.25 }]} fixed>MINUTA - NÃO ENVIAR</Text>}
      </Page>

      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <Text style={s.headerBrand}>Super<Text style={{ color: GREEN }}>Seg</Text></Text>
          <Text style={s.headerRef}>{ref} · {data.client.nome_fantasia || data.client.razao_social}</Text>
        </View>
        <View style={s.footer} fixed>
          <Text>{data.company.name}{data.company.cnpj ? ` · CNPJ ${formatCnpj(data.company.cnpj)}` : ""}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
        {data.draft && <Text style={s.watermark} fixed>MINUTA - NÃO ENVIAR</Text>}

        <Section title="1. Apresentação da SuperSeg">
          <Paragraphs text={data.texts.apresentacao} />
        </Section>

        <Section title="2. Identificação do cliente">
          <Row label="Razão social" value={data.client.razao_social} />
          <Row label="Nome fantasia" value={data.client.nome_fantasia} />
          <Row label="CNPJ" value={formatCnpj(data.client.cnpj)} />
          <Row label="Inscrição estadual" value={data.client.ie_isento ? "Isento" : data.client.inscricao_estadual} />
          <Row label="Endereço" value={data.client.address} />
          <Row label="Unidade atendida" value={data.unit ? `${data.unit.name}${data.unit.address ? ` - ${data.unit.address}` : ""}` : null} />
          <Row label="Responsável" value={data.contact ? [data.contact.name, data.contact.role_title].filter(Boolean).join(" - ") : null} />
          <Row label="E-mail" value={data.contact?.email} />
          <Row label="Telefone" value={data.contact?.phone} />
          <Row
            label="Faturamento"
            value={data.client.billing_cnpj ? `${data.client.billing_name ? `${data.client.billing_name} - ` : ""}CNPJ ${formatCnpj(data.client.billing_cnpj)}` : null}
          />
        </Section>

        <Section title="3. Objeto da proposta">
          {data.subject ? <Text style={[s.p, { fontFamily: "Helvetica-Bold" }]}>{data.subject}</Text> : null}
          <Paragraphs text={data.texts.objeto} />
        </Section>

        <Section title="4. Escopo técnico detalhado" newPage>
          {data.items.map((it, idx) => (
            <View key={idx} style={{ marginBottom: 8 }}>
              <Text style={s.h2} minPresenceAhead={60}>4.{idx + 1} {it.name}</Text>
              {it.description ? <View style={s.box}><Text>{it.description}</Text></View> : null}
              {it.technical_scope ? (<><Text style={s.h3}>Escopo técnico</Text><Paragraphs text={it.technical_scope} /></>) : null}
              {it.inclusions ? (<><Text style={s.h3}>Inclusões</Text><Bullets text={it.inclusions} /></>) : null}
              {it.exclusions ? (<><Text style={s.h3}>Exclusões</Text><Bullets text={it.exclusions} /></>) : null}
            </View>
          ))}
        </Section>

        <Section title="5. Investimento" newPage>
          <View style={s.tHead} wrap={false}>
            <Text style={s.cDesc}>Serviço</Text>
            <Text style={s.cQty}>Qtd.</Text>
            <Text style={s.cUnit}>Valor unit.</Text>
            <Text style={s.cDisc}>Desc.</Text>
            <Text style={s.cTotal}>Total</Text>
          </View>
          {data.items.map((it, idx) => (
            <View key={idx} style={idx % 2 ? [s.tRow, s.tRowAlt] : s.tRow} wrap={false}>
              <View style={s.cDesc}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{it.name}</Text>
                <Text style={{ fontSize: 8, color: GRAY }}>{it.code} · por {it.unit_label}</Text>
              </View>
              <Text style={s.cQty}>{qty(it.quantity)}</Text>
              <Text style={s.cUnit}>{formatBRL(it.unit_price_cents)}</Text>
              <Text style={s.cDisc}>{it.discount_percent > 0 ? `${qty(it.discount_percent)}%` : "-"}</Text>
              <Text style={s.cTotal}>{formatBRL(it.total_cents)}</Text>
            </View>
          ))}
          <View style={s.totalsBox} wrap={false}>
            {hasDiscount && (
              <>
                <View style={s.totalLine}><Text>Subtotal</Text><Text>{formatBRL(data.subtotalCents)}</Text></View>
                <View style={s.totalLine}><Text>Descontos</Text><Text>- {formatBRL(data.discountCents)}</Text></View>
              </>
            )}
            <View style={s.grand}><Text>TOTAL</Text><Text>{formatBRL(data.totalCents)}</Text></View>
          </View>
        </Section>

        <Section title="6. Condições de pagamento">
          <View style={s.box}><Text style={{ fontFamily: "Helvetica-Bold" }}>{data.paymentTerms}</Text></View>
          <Paragraphs text={data.texts.condicoes_pagamento} />
        </Section>

        <Section title="7. Cláusulas contratuais" newPage>
          <Paragraphs text={data.texts.clausulas} />
          {specificClauses.map((it, idx) => (
            <View key={idx}>
              <Text style={s.h2} minPresenceAhead={50}>Cláusulas específicas - {it.name}</Text>
              <Paragraphs text={it.specific_clauses} />
            </View>
          ))}
        </Section>

        <Section title="8. Formas de aceite">
          <Paragraphs text={data.texts.aceite} />
          <View style={s.sign} wrap={false}>
            <View style={s.signBox}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.company.name}</Text>
              <Text style={{ color: GRAY }}>{data.responsible}</Text>
            </View>
            <View style={s.signBox}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.client.razao_social}</Text>
              <Text style={{ color: GRAY }}>Nome / cargo / data</Text>
            </View>
          </View>
        </Section>
      </Page>
    </Document>
  );
}

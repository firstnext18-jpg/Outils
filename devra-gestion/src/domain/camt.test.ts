import { describe, expect, it } from "vitest";
import { amountToCents, CamtError, matchCredit, parseCamt } from "@/domain/camt";

const CAMT054 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.08">
  <BkToCstmrDbtCdtNtfctn>
    <GrpHdr><MsgId>MSG1</MsgId></GrpHdr>
    <Ntfctn>
      <Id>N1</Id>
      <Ntry>
        <Amt Ccy="CHF">1640.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts><Cd>BOOK</Cd></Sts>
        <BookgDt><Dt>2026-11-10</Dt></BookgDt>
        <AcctSvcrRef>ENTRY-1</AcctSvcrRef>
        <NtryDtls>
          <TxDtls>
            <Refs><AcctSvcrRef>TX-1</AcctSvcrRef><EndToEndId>NOTPROVIDED</EndToEndId></Refs>
            <Amt Ccy="CHF">1490.00</Amt>
            <RltdPties><Dbtr><Pty><Nm>Atelier Vélo SA</Nm></Pty></Dbtr></RltdPties>
            <RmtInf><Strd><CdtrRefInf><Ref>RF18 5390 0754 7034</Ref></CdtrRefInf></Strd></RmtInf>
          </TxDtls>
          <TxDtls>
            <Refs><AcctSvcrRef>TX-2</AcctSvcrRef></Refs>
            <Amt Ccy="CHF">150.00</Amt>
            <RltdPties><Dbtr><Nm>Jean Dupont</Nm></Dbtr></RltdPties>
            <RmtInf><Ustrd>Facture F-2026-007 merci</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="CHF">50.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <Sts><Cd>BOOK</Cd></Sts>
        <BookgDt><Dt>2026-11-10</Dt></BookgDt>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">80.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts><Cd>BOOK</Cd></Sts>
        <BookgDt><Dt>2026-11-10</Dt></BookgDt>
      </Ntry>
    </Ntfctn>
  </BkToCstmrDbtCdtNtfctn>
</Document>`;

const CAMT053 = `<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.04">
  <BkToCstmrStmt>
    <Stmt>
      <Ntry>
        <Amt Ccy="CHF">299.95</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>2026-11-11</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <RmtInf><Strd><CdtrRefInf><Ref>210000000003139471430009017</Ref></CdtrRefInf></Strd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="CHF">10.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts><Cd>PDNG</Cd></Sts>
        <BookgDt><Dt>2026-11-11</Dt></BookgDt>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

describe("relevés bancaires camt", () => {
  it("convertit les montants en centimes sans arrondi", () => {
    expect(amountToCents("1490.00")).toBe(149000);
    expect(amountToCents("299.95")).toBe(29995);
    expect(amountToCents("12.5")).toBe(1250);
    expect(amountToCents("7")).toBe(700);
    expect(amountToCents("abc")).toBeNull();
  });

  it("camt.054 : un crédit par paiement d'une écriture groupée, débits et devises étrangères ignorés", () => {
    const credits = parseCamt(CAMT054);
    expect(credits).toEqual([
      {
        key: "banque:TX-1",
        bookingDate: "2026-11-10",
        amountCents: 149000,
        reference: "RF18539007547034",
        remittance: "",
        debtorName: "Atelier Vélo SA",
      },
      {
        key: "banque:TX-2",
        bookingDate: "2026-11-10",
        amountCents: 15000,
        reference: "",
        remittance: "Facture F-2026-007 merci",
        debtorName: "Jean Dupont",
      },
    ]);
  });

  it("camt.053 : crédits comptabilisés seulement, clé stable sans référence bancaire", () => {
    const credits = parseCamt(CAMT053);
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({
      amountCents: 29995,
      reference: "210000000003139471430009017",
      bookingDate: "2026-11-11",
    });
    expect(credits[0]!.key).toMatch(/^empreinte:[0-9a-f]{40}$/);
    expect(parseCamt(CAMT053)[0]!.key).toBe(credits[0]!.key);
  });

  it("refuse un fichier qui n'est pas un relevé", () => {
    expect(() => parseCamt("<html><body>Bonjour</body></html>")).toThrow(CamtError);
  });

  it("rapproche par référence, puis numéro de facture, puis montant unique", () => {
    const invoices = [
      {
        id: "a",
        number: "F-2026-005",
        paymentReference: "RF18539007547034",
        outstandingCents: 149000,
      },
      { id: "b", number: "F-2026-007", paymentReference: "RF4712345", outstandingCents: 15000 },
      { id: "c", number: "F-2026-009", paymentReference: "RF99", outstandingCents: 29995 },
    ];
    const [qr, number] = parseCamt(CAMT054);
    expect(matchCredit(qr!, invoices)).toEqual({ invoiceId: "a", how: "reference" });
    expect(matchCredit(number!, invoices)).toEqual({ invoiceId: "b", how: "number" });
    const amountOnly = { ...number!, remittance: "", amountCents: 29995 };
    expect(matchCredit(amountOnly, invoices)).toEqual({ invoiceId: "c", how: "amount" });
    expect(matchCredit({ ...amountOnly, amountCents: 1 }, invoices)).toEqual({
      invoiceId: null,
      how: null,
    });
  });
});

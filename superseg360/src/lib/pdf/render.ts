import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ProposalDocument } from "./proposal-document";
import type { ProposalData } from "./types";

/** Logotipo opcional: coloque o arquivo em public/logo.png (PNG ou JPG). */
function loadLogo(): Buffer | null {
  const path = join(process.cwd(), "public", "logo.png");
  return existsSync(path) ? readFileSync(path) : null;
}

export async function renderProposalPdf(data: ProposalData): Promise<Buffer> {
  const element = createElement(ProposalDocument, { data, logo: loadLogo() });
  return renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadProposal } from "@/lib/proposal-loader";
import { renderProposalPdf } from "@/lib/pdf/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Não encontrado", { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Não autenticado", { status: 401 });

  const loaded = await loadProposal(supabase, id);
  if (!loaded) return new NextResponse("Proposta não encontrada", { status: 404 });

  const pdf = await renderProposalPdf(loaded.data);
  const clean = loaded.data.client.razao_social.normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40);
  const filename = `Proposta-${loaded.data.number}-v${loaded.data.version}-${clean}${loaded.data.draft ? "-MINUTA" : ""}.pdf`;
  const download = request.nextUrl.searchParams.get("download") === "1";

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { resumes } from "@/server/db/schema";
import { renderPdf } from "@/server/resumes/pdf";
import { createPrintToken } from "@/server/resumes/print-token";

export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session)
    return NextResponse.json(
      { error: "Sign in again to download." },
      { status: 401 },
    );

  const resume = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, id), eq(resumes.userId, session.user.id)),
    columns: { id: true, title: true },
  });
  if (!resume)
    return NextResponse.json({ error: "Resume not found." }, { status: 404 });

  const url = `${req.nextUrl.origin}/print/resume/${id}?t=${encodeURIComponent(createPrintToken(id))}`;
  try {
    const pdf = await renderPdf(url);
    const name = resume.title.replace(/[^\w\- ]+/g, "").trim() || "resume";
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "The PDF couldn't be made. Try again." },
      { status: 500 },
    );
  }
}

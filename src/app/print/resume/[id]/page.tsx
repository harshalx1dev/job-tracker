import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResumeDocument } from "@/features/resumes/resume-document";
import { normalizeDesign, pageSize } from "@/lib/resume";
import { getResumeForPrint } from "@/server/resumes/queries";
import { verifyPrintToken } from "@/server/resumes/print-token";
import "@/features/resumes/resume.css";

export const metadata: Metadata = {
  title: "Resume",
  robots: { index: false, follow: false },
};

/** Print-only render target for headless Chrome. Needs a short-lived signed token. */
export default function PrintResumePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  return (
    <Suspense>
      <PrintBody params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PrintBody({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  if (!verifyPrintToken(id, t)) notFound();
  const resume = await getResumeForPrint(id);
  if (!resume) notFound();
  const design = normalizeDesign(resume.design);
  const size = pageSize(design);
  return (
    <>
      {/* Chrome paints the page margins with the root background: keep it white
          even when the app's dark theme is active. */}
      <style>{`@page { size: ${size.css}; margin: ${design.margin}mm 0; }
:root, html, body { background: #fff !important; color-scheme: light !important; }`}</style>
      <ResumeDocument content={resume.content} design={design} />
    </>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResumeDocument } from "@/features/resumes/resume-document";
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
  return <ResumeDocument content={resume.content} design={resume.design} />;
}

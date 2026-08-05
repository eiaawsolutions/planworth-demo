import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { tryLoad } from "@/lib/load";
import { scenarioBySlug } from "@/lib/scenarios";
import { isAiConfigured } from "@/lib/anthropic";
import { formatMyrPrecise } from "@/lib/money";
import { ScenarioShell, Panel } from "@/components/scenario-shell";
import { DataUnavailable } from "@/components/data-unavailable";
import {
  DocumentInspector,
  type DocumentSummary,
} from "@/components/document-inspector";

export const metadata: Metadata = {
  title: "Intelligent Document Processing",
  robots: "noindex, nofollow",
};

export const dynamic = "force-dynamic";

export default async function IdpPage() {
  const scenario = scenarioBySlug("idp");
  if (!scenario) notFound();

  const loaded = await tryLoad(() =>
    prisma.documentRecord.findMany({
      orderBy: { createdAt: "asc" },
      include: { application: { include: { client: true } } },
    }),
  );

  if (!loaded.ok) {
    return (
      <ScenarioShell scenario={scenario}>
        <DataUnavailable reason="unreachable" what="the submitted documents and the records it reconciles them against" />
      </ScenarioShell>
    );
  }

  const rows = loaded.data;

  // BigInt cannot cross the server/client boundary — format on the server.
  const documents: DocumentSummary[] = rows.map((d) => ({
    id: d.id,
    kind: d.kind,
    label: d.label,
    assetPath: d.assetPath,
    isDeliberateMismatch: d.isDeliberateMismatch,
    applicationReference: d.application.reference,
    clientName: d.application.client.name,
    declaredAmount:
      d.application.declaredAmountSen == null
        ? null
        : formatMyrPrecise(d.application.declaredAmountSen),
    awardingBody: d.application.awardingBody,
    contractReference: d.application.contractReference,
  }));

  return (
    <ScenarioShell scenario={scenario}>
      <div className="flex flex-col gap-6">
        <DocumentInspector documents={documents} configured={isAiConfigured()} />

        <Panel step="01" title="Why these five documents">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-[13.5px] leading-relaxed text-muted">
                The set is chosen to be a fair test rather than a flattering one:
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {[
                  {
                    t: "The brief's own worked example",
                    d: "Invoice #1024, 25 October 2024, 50,000, ACME CORP — the exact figures printed on slide 8, so you can check the demo against the document you were shown.",
                  },
                  {
                    t: "Three clean Malaysian documents",
                    d: "A JKR invoice, a TNB purchase order and a JKR letter of award — the shapes Planworth actually handles, with the counterparty on a different side of the transaction in each.",
                  },
                  {
                    t: "One degraded scan that disagrees",
                    d: "A certified progress claim, photographed off-square with grain and contrast loss, whose certified figure differs from the amount the applicant declared. This is the case the scenario exists for.",
                  },
                ].map((item) => (
                  <li key={item.t}>
                    <p className="text-[13.5px] font-semibold text-navy">
                      {item.t}
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                      {item.d}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="pw-eyebrow">A note on the mismatch</p>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-navy/85">
                The discrepancy is a digit transposition — the certified claim reads
                RM 742,500.00 while the application declares RM 724,500.00. That is
                deliberate: transposition is the error a human re-keying a figure
                actually makes, and it is exactly the kind that survives a quick
                eyeball because both numbers look reasonable.
              </p>
              <p className="mt-3 text-[13.5px] leading-relaxed text-navy/85">
                Note that the model is told to report what is printed and not to
                correct it. An extractor that helpfully &ldquo;fixes&rdquo; a figure
                to match the file would hide precisely the discrepancy this scenario
                is meant to catch.
              </p>

              <div className="mt-5 rounded-lg border border-line bg-cream px-4 py-3.5">
                <p className="text-[12.5px] leading-relaxed text-muted">
                  Documents also carry an injection risk: a submitted page is
                  untrusted input, and text inside it can attempt to instruct the
                  model. The prompt treats document content as content, never as
                  direction, and the verdict is computed in application code from the
                  extracted values — the model never decides the verdict itself.
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel step="02" title="What the reconciliation actually compares">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                t: "Claim total",
                d: "Compared to the sen against the amount declared on the application. This is the only field that can produce an unreadable verdict — if the total cannot be read, nothing can be reconciled.",
              },
              {
                t: "Counterparty",
                d: "Compared to the awarding body or buyer on file, ignoring corporate suffixes so that 'MRT Corp Sdn Bhd' and 'MRT Corp' are not treated as different parties.",
              },
              {
                t: "Contract reference",
                d: "Compared after stripping punctuation and case. A missing reference is not a mismatch — plenty of legitimate documents omit it.",
              },
            ].map((c) => (
              <div key={c.t} className="rounded-lg border border-line bg-cream px-4 py-3.5">
                <p className="text-[13px] font-semibold text-navy">{c.t}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                  {c.d}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[12px] leading-relaxed text-muted-soft">
            Document number and date are extracted and shown but marked
            informational — the CRM holds nothing to check them against, and
            presenting an unchecked field as verified would be the same mistake in
            miniature.
          </p>
        </Panel>
      </div>
    </ScenarioShell>
  );
}

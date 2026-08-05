import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/scenario-shell";
import { GoldRule, Pill } from "@/components/atoms";
import { SCENARIOS } from "@/lib/scenarios";

export const metadata: Metadata = {
  title: "Native Architectural Integration",
  robots: "noindex, nofollow",
};

export default function ArchitecturePage() {
  return (
    <>
      <SiteHeader current="architecture" />

      <main className="flex-1">
        <section className="pw-ground-cream border-b border-line">
          <div className="mx-auto max-w-[1180px] px-5 pt-10 pb-9 md:px-8 md:pt-14">
            <p className="pw-eyebrow">From the brief · slide 12</p>
            <h1 className="pw-serif mt-4 text-[clamp(1.7rem,3.8vw,2.7rem)] leading-[1.08] text-navy">
              Native architectural integration
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
              AI models embedded within the proposed Claritas cloud infrastructure,
              rather than bolted alongside it.
            </p>
            <GoldRule className="mt-8 max-w-md" />
          </div>
        </section>

        <div className="mx-auto max-w-[1180px] px-5 py-10 md:px-8 md:py-14">
          <div className="flex flex-col gap-6">
            {/* The honest framing, first */}
            <section
              className="pw-card rounded-xl p-5 md:p-6"
              style={{ borderColor: "rgba(167,149,111,0.55)" }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <Pill tone="gold" dot>
                  Target state
                </Pill>
                <h2 className="text-[13px] font-semibold text-navy">
                  This diagram is the recommendation, not this demo
                </h2>
              </div>
              <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-navy/85">
                What follows is the production architecture the brief proposes — a
                GCP deployment inside the Claritas estate. It is not what you are
                looking at right now. This demo runs on Railway with a managed
                Postgres instance, because standing up a client&rsquo;s cloud estate
                to prove a concept would be the wrong order of work.
              </p>
              <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-muted">
                Both are stated because showing a GCP diagram while quietly running
                somewhere else is the kind of small dishonesty that costs a vendor
                credibility in a technical review. The mapping between the two is at
                the bottom of this page.
              </p>
            </section>

            {/* The diagram */}
            <section className="pw-card rounded-xl p-5 md:p-6">
              <h2 className="pw-eyebrow">
                Proposed production topology — Claritas cloud (GCP)
              </h2>

              <div className="mt-6 overflow-x-auto">
                <svg
                  viewBox="0 0 1080 420"
                  className="h-auto w-full min-w-[860px]"
                  role="img"
                  aria-label="Request flow: a user reaches the omni-channel interface, which passes through Cloud Load Balancing and Cloud Armor into a production subnet containing two Compute Engine instances, CRMAPPW1 and CRMINTW1, which handle intelligent document processing and connect to CRMDBW1, a Cloud SQL instance used for ML risk core ingestion."
                >
                  <defs>
                    <marker
                      id="arrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#2e3548" />
                    </marker>
                  </defs>

                  {/* Production boundary */}
                  <rect
                    x="470"
                    y="42"
                    width="440"
                    height="336"
                    rx="14"
                    fill="rgba(11,27,50,0.02)"
                    stroke="rgba(11,27,50,0.20)"
                    strokeDasharray="6 5"
                  />
                  <text
                    x="490"
                    y="70"
                    fontSize="11"
                    fontWeight="700"
                    letterSpacing="0.18em"
                    fill="#2e3548"
                  >
                    PRODUCTION
                  </text>

                  {/* User */}
                  <circle cx="46" cy="210" r="20" fill="none" stroke="#0b1b32" strokeWidth="1.5" />
                  <circle cx="46" cy="202" r="7" fill="none" stroke="#0b1b32" strokeWidth="1.5" />
                  <path
                    d="M34 224 C36 214 56 214 58 224"
                    fill="none"
                    stroke="#0b1b32"
                    strokeWidth="1.5"
                  />
                  <text x="46" y="256" textAnchor="middle" fontSize="11.5" fill="#2e3548">
                    Client / prospect
                  </text>

                  {/* Omni-channel interface */}
                  <Node
                    x={104}
                    y={168}
                    w={168}
                    h={84}
                    title="Omni-channel interface"
                    sub="Conversational AI · predictive triggers"
                    accent
                  />

                  {/* Edge: LB + Armor */}
                  <Node
                    x={300}
                    y={92}
                    w={140}
                    h={72}
                    title="Cloud Load Balancing"
                    sub="Ingress"
                  />
                  <Node
                    x={300}
                    y={256}
                    w={140}
                    h={72}
                    title="Cloud Armor"
                    sub="Adaptive security"
                    accent
                  />

                  {/* Compute */}
                  <Node
                    x={506}
                    y={104}
                    w={170}
                    h={80}
                    title="CRMAPPW1"
                    sub="Compute Engine · app tier"
                    accent
                  />
                  <Node
                    x={506}
                    y={236}
                    w={170}
                    h={80}
                    title="CRMINTW1"
                    sub="Compute Engine · integration tier"
                    accent
                  />

                  {/* Database */}
                  <Node
                    x={730}
                    y={168}
                    w={158}
                    h={84}
                    title="CRMDBW1"
                    sub="Cloud SQL · ML risk core"
                    accent
                  />

                  {/* Flows */}
                  <line x1="70" y1="210" x2="100" y2="210" stroke="#2e3548" strokeWidth="1.4" markerEnd="url(#arrow)" />
                  <path d="M272 196 C288 196 288 128 296 128" fill="none" stroke="#2e3548" strokeWidth="1.4" markerEnd="url(#arrow)" />
                  <path d="M272 224 C288 224 288 292 296 292" fill="none" stroke="#2e3548" strokeWidth="1.4" markerEnd="url(#arrow)" />
                  <path d="M440 128 C470 128 476 144 502 144" fill="none" stroke="#2e3548" strokeWidth="1.4" markerEnd="url(#arrow)" />
                  <path d="M440 292 C470 292 476 276 502 276" fill="none" stroke="#2e3548" strokeWidth="1.4" markerEnd="url(#arrow)" />
                  <path d="M676 144 C702 144 706 196 726 200" fill="none" stroke="#2e3548" strokeWidth="1.4" markerEnd="url(#arrow)" />
                  <path d="M676 276 C702 276 706 224 726 220" fill="none" stroke="#2e3548" strokeWidth="1.4" markerEnd="url(#arrow)" />

                  {/* Mutual link between the two compute tiers */}
                  <line
                    x1="591"
                    y1="184"
                    x2="591"
                    y2="236"
                    stroke="#a7956f"
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                  />

                  {/* Callout: IDP spans both compute tiers */}
                  <text x="591" y="352" textAnchor="middle" fontSize="11" fontWeight="600" fill="#2e3548">
                    Intelligent document processing
                  </text>
                  <line x1="591" y1="330" x2="591" y2="340" stroke="#a7956f" strokeWidth="1.2" />
                </svg>
              </div>

              <p className="mt-4 text-[12px] leading-relaxed text-muted">
                Instance names, tiers and service placement are reproduced from slide
                12 of the brief. Gold-outlined nodes are the ones the brief
                identifies as carrying AI workloads.
              </p>
            </section>

            {/* Where each scenario lands */}
            <section className="pw-card rounded-xl p-5 md:p-6">
              <h2 className="pw-eyebrow">Where each scenario runs</h2>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-left">
                  <thead>
                    <tr>
                      <th scope="col" className="border-b border-line-strong pb-3 text-[10px] font-semibold tracking-[0.18em] uppercase text-navy-slate">
                        Scenario
                      </th>
                      <th scope="col" className="border-b border-line-strong pb-3 text-[10px] font-semibold tracking-[0.18em] uppercase text-navy-slate">
                        Tier in the target state
                      </th>
                      <th scope="col" className="border-b border-line-strong pb-3 text-[10px] font-semibold tracking-[0.18em] uppercase text-navy-slate">
                        In this demo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        slug: "engagement",
                        tier: "CRMINTW1 → CRMDBW1, plus the omni-channel interface for delivery",
                        demo: "Server component reading seeded Postgres rows",
                      },
                      {
                        slug: "triage",
                        tier: "Omni-channel interface, fronted by Cloud Armor",
                        demo: "Streamed route handler calling Claude directly",
                      },
                      {
                        slug: "idp",
                        tier: "CRMAPPW1 and CRMINTW1",
                        demo: "Route handler calling Claude, writing back to Postgres",
                      },
                      {
                        slug: "risk",
                        tier: "CRMDBW1 — the ML risk core ingestion path",
                        demo: "Scorecard computed per request, nothing stored",
                      },
                      {
                        slug: "security",
                        tier: "Cloud Armor, with signals from every tier",
                        demo: "Deterministic scoring over a seeded access log",
                      },
                    ].map((row) => {
                      const s = SCENARIOS.find((x) => x.slug === row.slug)!;
                      return (
                        <tr key={row.slug} className="align-top">
                          <th scope="row" className="border-b border-line py-3.5 pr-5 text-[13.5px] font-semibold text-navy">
                            {s.number}. {s.title}
                            <span className="mt-1.5 block">
                              <Pill tone={s.mode === "real" ? "positive" : "gold"}>
                                {s.mode === "real" ? "Live" : "Simulated"}
                              </Pill>
                            </span>
                          </th>
                          <td className="border-b border-line py-3.5 pr-5 text-[13px] leading-snug text-muted">
                            {row.tier}
                          </td>
                          <td className="border-b border-line py-3.5 text-[13px] leading-snug text-muted">
                            {row.demo}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* The gap between demo and target */}
            <section className="pw-card rounded-xl p-5 md:p-6">
              <h2 className="pw-eyebrow">What the demo does not have</h2>
              <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-navy/85">
                Worth naming, because these are the items that separate a working
                preview from something Planworth could put in front of a client.
              </p>
              <ul className="mt-5 grid gap-3 md:grid-cols-2">
                {[
                  "No Claritas CRM connection. Every record here is a local fixture; a live deployment reads and writes the real customer graph.",
                  "No WhatsApp Business API. The engagement scenario drafts a message and stops — it has no channel to send on, and no consent record to send against.",
                  "Rate limiting is in-process memory. It resets on deploy and does not coordinate across instances; production wants Redis or the platform limiter.",
                  "Secrets resolve through Infisical handles, but there is no Cloud Armor, WAF or private networking in front of this demo.",
                  "No PDPA data-residency controls. Model calls leave Malaysia; a regulated deployment needs that assessed and, if required, region-pinned inference.",
                  "No human approval queue. The scenarios show what would be routed for sign-off; the queue that holds it does not exist here.",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 rounded-lg border border-line bg-cream px-4 py-3 text-[13px] leading-relaxed text-navy/85"
                  >
                    <span aria-hidden="true" className="shrink-0 text-navy-slate">
                      ·
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

/* ── SVG node helper ──────────────────────────────────────────*/

function Node({
  x,
  y,
  w,
  h,
  title,
  sub,
  accent = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="9"
        fill="#fbfbf7"
        stroke={accent ? "#a7956f" : "rgba(11,27,50,0.24)"}
        strokeWidth={accent ? 1.6 : 1.2}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 - 6}
        textAnchor="middle"
        fontSize="13.5"
        fontWeight="700"
        fill="#0b1b32"
      >
        {title}
      </text>
      <text
        x={x + w / 2}
        y={y + h / 2 + 13}
        textAnchor="middle"
        fontSize="10.5"
        fill="#2e3548"
      >
        {sub}
      </text>
    </g>
  );
}

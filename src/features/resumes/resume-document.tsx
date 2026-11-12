import type { CSSProperties, ReactNode } from "react";
import {
  RESUME_SECTIONS,
  dateRange,
  normalizeDesign,
  visibleSections,
  type ResumeDesign,
  type ResumeSectionKey,
} from "@/lib/resume";
import type { Profile } from "@/lib/profile";
import {
  headingText,
  isHeadingLine,
  parseRichText,
  safeHref,
} from "@/lib/rich-text";
import { resumeFontClassName, resumeFontFamily } from "./resume-fonts";

/**
 * The resume itself: semantic HTML, real text only. The builder preview, the
 * paginated preview and the PDF render this same component. Pagination units are
 * marked with data-unit (never split) and data-keep="next" (stay with the next unit).
 */
export function ResumeDocument({
  content,
  design: rawDesign,
}: {
  content: Profile;
  design: ResumeDesign;
}) {
  const design = normalizeDesign(rawDesign);
  const b = content.basics;
  const sections = visibleSections(content, design);
  const center = design.headerAlign === "center";

  const style = {
    "--rz-font": resumeFontFamily[design.font],
    "--rz-size": `${design.fontSize}pt`,
    "--rz-lh": design.lineHeight,
    "--rz-margin": `${design.margin}mm`,
    "--rz-gap": `${design.sectionGap}mm`,
    "--rz-accent": design.accent,
  } as CSSProperties;

  const classes = [
    "rz-page",
    resumeFontClassName,
    `rz--${design.template}`,
    center ? "rz-center" : "rz-left",
    design.linkUnderline ? "rz-u" : "",
    `rz-rule-${design.headingRule}`,
    `rz-case-${design.headingCase}`,
    ...design.accentOn.map((a) => `rz-on-${a}`),
  ]
    .filter(Boolean)
    .join(" ");

  const ctx: Ctx = { linkIcon: design.linkIcon, design };

  const contact: {
    key: string;
    icon: IconName;
    text: string;
    href?: string;
  }[] = [];
  if (b.email)
    contact.push({
      key: "email",
      icon: "mail",
      text: b.email,
      href: `mailto:${b.email}`,
    });
  if (b.phone) contact.push({ key: "phone", icon: "phone", text: b.phone });
  if (b.location) contact.push({ key: "loc", icon: "pin", text: b.location });
  b.links.forEach((l, i) => {
    const href = safeHref(l.url);
    const text = l.label || l.url.replace(/^https?:\/\/(www\.)?/, "");
    if (!text) return;
    contact.push({
      key: `l${i}`,
      icon: linkIconFor(l.label, l.url),
      text,
      href: href ?? undefined,
    });
  });
  const sep =
    design.contactStyle === "dots"
      ? " · "
      : design.contactStyle === "bars"
        ? " | "
        : null;

  return (
    <article className={classes} style={style} lang="en">
      <header className="rz-head" data-unit>
        <div className="rz-titleline">
          <h1 className="rz-name">{b.name || "Your name"}</h1>
          {b.headline && <span className="rz-headline">{b.headline}</span>}
        </div>
        {contact.length > 0 && (
          <p className="rz-contact">
            {contact.map((c, i) => (
              <span key={c.key} className="rz-contact-item">
                {sep && i > 0 && <span className="rz-sep">{sep}</span>}
                {!sep && <Icon name={c.icon} className="rz-ico" />}
                {c.href ? (
                  <a className="rz-a" href={c.href}>
                    {c.text}
                  </a>
                ) : (
                  c.text
                )}
              </span>
            ))}
          </p>
        )}
      </header>

      <div className="rz-body">
        <div className="rz-main">
          {sections.map((key) => (
            <Section key={key} sectionKey={key} content={content} ctx={ctx} />
          ))}
        </div>
      </div>
    </article>
  );
}

type Ctx = { linkIcon: boolean; design: ResumeDesign };

/* ---------- inline text ---------- */

function Rich({ text, ctx }: { text: string; ctx: Ctx }) {
  return (
    <>
      {parseRichText(text).map((t, i) => {
        let node: ReactNode = t.text;
        if (t.bold) node = <strong>{node}</strong>;
        if (t.italic) node = <em>{node}</em>;
        if (t.href)
          node = (
            <Link href={t.href} ctx={ctx}>
              {node}
            </Link>
          );
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

function Link({
  href,
  ctx,
  children,
}: {
  href: string;
  ctx: Ctx;
  children: ReactNode;
}) {
  const safe = safeHref(href);
  if (!safe) return <>{children}</>;
  return (
    <a className="rz-a" href={safe}>
      {children}
      {ctx.linkIcon && <Icon name="link" className="rz-linkico" />}
    </a>
  );
}

/** Plain text that links when a URL is present. */
function Maybe({
  url,
  ctx,
  children,
}: {
  url?: string;
  ctx: Ctx;
  children: ReactNode;
}) {
  return url && safeHref(url) ? (
    <Link href={url} ctx={ctx}>
      {children}
    </Link>
  ) : (
    <>{children}</>
  );
}

/* ---------- icons ---------- */

type IconName = "mail" | "phone" | "pin" | "linkedin" | "github" | "link";

function linkIconFor(label: string, url: string): IconName {
  const s = `${label} ${url}`.toLowerCase();
  if (s.includes("linkedin")) return "linkedin";
  if (s.includes("github")) return "github";
  return "link";
}

const ICONS: Record<IconName, ReactNode> = {
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  linkedin: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
  github: (
    <>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </>
  ),
};

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/* ---------- sections ---------- */

function Section({
  sectionKey,
  content,
  ctx,
}: {
  sectionKey: ResumeSectionKey;
  content: Profile;
  ctx: Ctx;
}) {
  const title = RESUME_SECTIONS.find((s) => s.key === sectionKey)?.label ?? "";
  return (
    <section className="rz-section">
      <h2 className="rz-h2" data-unit data-keep="next">
        {title}
      </h2>
      <Body sectionKey={sectionKey} c={content} ctx={ctx} />
    </section>
  );
}

function Bullets({ items, ctx }: { items: string[]; ctx: Ctx }) {
  const list = items.filter((h) => h.trim());
  if (!list.length) return null;
  // A "## " line names a group of bullets (a project under a role): it is a
  // heading that stays with the bullets after it, not a bullet itself.
  const blocks: ({ heading: string } | { bullets: string[] })[] = [];
  for (const h of list) {
    if (isHeadingLine(h)) blocks.push({ heading: headingText(h) });
    else {
      const last = blocks[blocks.length - 1];
      if (last && "bullets" in last) last.bullets.push(h);
      else blocks.push({ bullets: [h] });
    }
  }
  return (
    <>
      {blocks.map((b, i) =>
        "heading" in b ? (
          <p key={i} className="rz-subhead" data-unit data-keep="next">
            <Rich text={b.heading} ctx={ctx} />
          </p>
        ) : (
          <ul key={i} className="rz-list">
            {b.bullets.map((h, j) => (
              <li key={j} data-unit>
                <Rich text={h} ctx={ctx} />
              </li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}

function Meta({ dates, place }: { dates: string; place?: string }) {
  const parts = [dates, place].filter(Boolean);
  if (!parts.length) return null;
  return (
    <span className="rz-dates">
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="rz-bar"> | </span>}
          {p}
        </span>
      ))}
    </span>
  );
}

function Body({
  sectionKey,
  c,
  ctx,
}: {
  sectionKey: ResumeSectionKey;
  c: Profile;
  ctx: Ctx;
}) {
  const { design } = ctx;
  const right = design.datePosition === "right";

  switch (sectionKey) {
    case "summary":
      return (
        <p className="rz-text" data-unit>
          <Rich text={c.summary} ctx={ctx} />
        </p>
      );

    case "experience":
      return (
        <>
          {c.experience.map((e, i) => {
            const meta = (
              <Meta
                dates={dateRange(e.start, e.end, design.dateFormat)}
                place={e.location}
              />
            );
            return (
              <div key={i} className="rz-entry">
                <div
                  className="rz-row"
                  data-unit
                  data-keep={e.highlights.length ? "next" : undefined}
                >
                  <div className="rz-left">
                    <span className="rz-title">
                      {e.title}
                      {e.company && e.title ? (
                        <span className="rz-comma">,</span>
                      ) : null}
                    </span>{" "}
                    {e.company && (
                      <em className="rz-org rz-sub">
                        <Maybe url={e.url} ctx={ctx}>
                          {e.company}
                        </Maybe>
                      </em>
                    )}
                    {!right && <div className="rz-below">{meta}</div>}
                  </div>
                  {right && <div className="rz-right">{meta}</div>}
                </div>
                <Bullets items={e.highlights} ctx={ctx} />
              </div>
            );
          })}
        </>
      );

    case "projects":
      return (
        <>
          {c.projects.map((p, i) => {
            const sub = [p.subtitle, p.tech.join(" · ")]
              .filter((x) => x && x.trim())
              .join(" · ");
            const inline = design.subtitle === "inline";
            const hl = (p.highlights ?? []).filter((h) => h.trim());
            const hasBody = !!p.description || hl.length > 0;
            return (
              <div key={i} className="rz-entry">
                <div
                  className="rz-row"
                  data-unit
                  data-keep={hasBody ? "next" : undefined}
                >
                  <div className="rz-left">
                    <span className="rz-title">
                      <Maybe url={p.url} ctx={ctx}>
                        {p.name}
                      </Maybe>
                      {sub && inline ? (
                        <span className="rz-comma">,</span>
                      ) : null}
                    </span>
                    {sub && inline && (
                      <>
                        {" "}
                        <em className="rz-org rz-sub">
                          <Rich text={sub} ctx={ctx} />
                        </em>
                      </>
                    )}
                    {sub && !inline && (
                      <div className="rz-below">
                        <em className="rz-org">
                          <Rich text={sub} ctx={ctx} />
                        </em>
                      </div>
                    )}
                  </div>
                </div>
                {p.description && (
                  <p className="rz-text" data-unit>
                    <Rich text={p.description} ctx={ctx} />
                  </p>
                )}
                <Bullets items={hl} ctx={ctx} />
              </div>
            );
          })}
        </>
      );

    case "skills":
      return (
        <div className="rz-skills">
          {c.skills.map((g, i) => (
            <p key={i} className="rz-skill" data-unit>
              {g.group && <strong className="rz-group">{g.group}: </strong>}
              {g.items.join(", ")}
            </p>
          ))}
        </div>
      );

    case "education":
      return (
        <>
          {c.education.map((e, i) => {
            const details = (e.details ?? []).filter((d) => d.trim());
            const meta = (
              <Meta
                dates={dateRange(e.start, e.end, design.dateFormat)}
                place={e.location}
              />
            );
            return (
              <div key={i} className="rz-entry">
                <div
                  className="rz-row"
                  data-unit
                  data-keep={details.length ? "next" : undefined}
                >
                  <div className="rz-left">
                    <span className="rz-title">
                      {[e.degree, e.field].filter(Boolean).join(", ")}
                    </span>
                    {e.school && (
                      <div className="rz-below">
                        <em className="rz-org">{e.school}</em>
                      </div>
                    )}
                    {!right && <div className="rz-below">{meta}</div>}
                  </div>
                  {right && <div className="rz-right">{meta}</div>}
                </div>
                {details.map((d, j) => (
                  <p key={j} className="rz-text" data-unit>
                    <Rich text={d} ctx={ctx} />
                  </p>
                ))}
              </div>
            );
          })}
        </>
      );

    case "certifications":
      return (
        <div className="rz-certs">
          {c.certifications.map((x, i) => (
            <div key={i} className="rz-row rz-cert" data-unit>
              <div className="rz-left">
                <span className="rz-title">
                  <Maybe url={x.url} ctx={ctx}>
                    {x.name}
                  </Maybe>
                </span>
                {x.issuer && (
                  <>
                    {", "}
                    <em className="rz-org">{x.issuer}</em>
                  </>
                )}
              </div>
              {x.year && (
                <div className="rz-right">
                  <span className="rz-dates">{x.year}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      );
  }
}

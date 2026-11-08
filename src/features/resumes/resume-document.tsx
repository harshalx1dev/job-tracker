import {
  dateRange,
  visibleSections,
  type ResumeDesign,
  type ResumeSectionKey,
} from "@/lib/resume";
import type { Profile } from "@/lib/profile";

/**
 * The resume itself: semantic HTML on an A4 page. The builder preview and the PDF
 * render this same component, so what you see is what downloads. Real text only
 * (no images of text), headings in order, one column for the ATS-safe templates.
 */
export function ResumeDocument({
  content,
  design,
}: {
  content: Profile;
  design: ResumeDesign;
}) {
  const b = content.basics;
  const sections = visibleSections(content, design);
  const side: ResumeSectionKey[] =
    design.template === "column"
      ? ["skills", "education", "certifications"]
      : [];
  const main = sections.filter((s) => !side.includes(s));
  const aside = sections.filter((s) => side.includes(s));

  const contact = [
    b.email,
    b.phone,
    b.location,
    ...b.links.map((l) => l.url.replace(/^https?:\/\/(www\.)?/, "")),
  ].filter(Boolean);

  return (
    <article
      className={`rz-page rz--${design.template} rz--${design.font} rz--d-${design.density}`}
      style={{ "--rz-accent": design.accent } as React.CSSProperties}
      lang="en"
    >
      <header className="rz-head">
        <h1 className="rz-name">{b.name || "Your name"}</h1>
        {b.headline && <p className="rz-headline">{b.headline}</p>}
        {contact.length > 0 && (
          <p className="rz-contact">
            {contact.map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </p>
        )}
      </header>

      <div className={aside.length ? "rz-body rz-body--split" : "rz-body"}>
        <div className="rz-main">
          {main.map((key) => (
            <Section key={key} sectionKey={key} content={content} />
          ))}
        </div>
        {aside.length > 0 && (
          <aside className="rz-aside">
            {aside.map((key) => (
              <Section key={key} sectionKey={key} content={content} />
            ))}
          </aside>
        )}
      </div>
    </article>
  );
}

const TITLES: Record<ResumeSectionKey, string> = {
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
  certifications: "Certifications",
};

function Section({
  sectionKey,
  content,
}: {
  sectionKey: ResumeSectionKey;
  content: Profile;
}) {
  return (
    <section className="rz-section">
      <h2 className="rz-h2">{TITLES[sectionKey]}</h2>
      <SectionBody sectionKey={sectionKey} content={content} />
    </section>
  );
}

function SectionBody({
  sectionKey,
  content: c,
}: {
  sectionKey: ResumeSectionKey;
  content: Profile;
}) {
  switch (sectionKey) {
    case "summary":
      return <p className="rz-text">{c.summary}</p>;
    case "experience":
      return (
        <>
          {c.experience.map((e, i) => (
            <div key={i} className="rz-item">
              <div className="rz-row">
                <h3 className="rz-h3">
                  {e.title}
                  {e.company && <span className="rz-at"> · {e.company}</span>}
                </h3>
                <span className="rz-date">{dateRange(e.start, e.end)}</span>
              </div>
              {e.location && <p className="rz-meta">{e.location}</p>}
              {e.highlights.length > 0 && (
                <ul className="rz-list">
                  {e.highlights.map((h, j) => (
                    <li key={j}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      );
    case "projects":
      return (
        <>
          {c.projects.map((p, i) => (
            <div key={i} className="rz-item">
              <div className="rz-row">
                <h3 className="rz-h3">{p.name}</h3>
                {p.url && (
                  <span className="rz-date">
                    {p.url.replace(/^https?:\/\/(www\.)?/, "")}
                  </span>
                )}
              </div>
              {p.description && <p className="rz-text">{p.description}</p>}
              {p.tech.length > 0 && (
                <p className="rz-meta">{p.tech.join(" · ")}</p>
              )}
            </div>
          ))}
        </>
      );
    case "skills":
      return (
        <dl className="rz-skills">
          {c.skills.map((g, i) => (
            <div key={i}>
              {g.group && <dt>{g.group}</dt>}
              <dd>{g.items.join(", ")}</dd>
            </div>
          ))}
        </dl>
      );
    case "education":
      return (
        <>
          {c.education.map((e, i) => (
            <div key={i} className="rz-item">
              <div className="rz-row">
                <h3 className="rz-h3">
                  {[e.degree, e.field].filter(Boolean).join(", ")}
                </h3>
                <span className="rz-date">{dateRange(e.start, e.end)}</span>
              </div>
              <p className="rz-meta">{e.school}</p>
            </div>
          ))}
        </>
      );
    case "certifications":
      return (
        <ul className="rz-list rz-list--plain">
          {c.certifications.map((x, i) => (
            <li key={i}>
              {x.name}
              {(x.issuer || x.year) && (
                <span className="rz-meta">
                  {" "}
                  · {[x.issuer, x.year].filter(Boolean).join(", ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      );
  }
}

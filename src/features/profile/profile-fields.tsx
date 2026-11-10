"use client";

import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/lib/profile";
import { CommaInput, Field, LinesInput, ListEditor, TextInput } from "./fields";

/**
 * Every profile section as a form. Used by the profile page and by the resume
 * builder (which edits its own copy). Re-key the parent to reset local input text.
 */
export function ProfileFields({
  profile,
  onChange,
  showExtra = true,
}: {
  profile: Profile;
  onChange: (next: Profile | ((p: Profile) => Profile)) => void;
  showExtra?: boolean;
}) {
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    onChange((p) => ({ ...p, [key]: value }));
  const setBasics = (patch: Partial<Profile["basics"]>) =>
    onChange((p) => ({ ...p, basics: { ...p.basics, ...patch } }));

  return (
    <>
      <Block id="basics" title="Basics">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name">
            <TextInput
              value={profile.basics.name}
              onChange={(e) => setBasics({ name: e.target.value })}
            />
          </Field>
          <Field label="Headline">
            <TextInput
              value={profile.basics.headline}
              placeholder="Senior Frontend Engineer"
              onChange={(e) => setBasics({ headline: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <TextInput
              type="email"
              value={profile.basics.email}
              onChange={(e) => setBasics({ email: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <TextInput
              value={profile.basics.phone}
              onChange={(e) => setBasics({ phone: e.target.value })}
            />
          </Field>
          <Field label="Location" className="sm:col-span-2">
            <TextInput
              value={profile.basics.location}
              onChange={(e) => setBasics({ location: e.target.value })}
            />
          </Field>
        </div>
        <p className="mt-5 mb-2 text-xs font-medium text-muted-foreground">
          Links
        </p>
        <ListEditor
          items={profile.basics.links}
          onChange={(links) => setBasics({ links })}
          make={() => ({ label: "", url: "" })}
          title={(l) => l.label}
          addLabel="Add link"
          render={(l, setL) => (
            <>
              <Field label="Label">
                <TextInput
                  value={l.label}
                  placeholder="GitHub"
                  onChange={(e) => setL({ label: e.target.value })}
                />
              </Field>
              <Field label="URL">
                <TextInput
                  value={l.url}
                  placeholder="https://"
                  onChange={(e) => setL({ url: e.target.value })}
                />
              </Field>
            </>
          )}
        />
      </Block>

      <Block id="summary" title="Summary">
        <Field label="Text" hint="**bold**, *italic*, [text](https://link)">
          <Textarea
            rows={4}
            value={profile.summary}
            onChange={(e) => set("summary", e.target.value)}
          />
        </Field>
      </Block>

      <Block id="experience" title="Experience">
        <ListEditor
          items={profile.experience}
          onChange={(v) => set("experience", v)}
          make={() => ({
            company: "",
            title: "",
            location: "",
            start: "",
            end: "",
            highlights: [],
          })}
          title={(x) => [x.title, x.company].filter(Boolean).join(" · ")}
          addLabel="Add role"
          render={(x, setX) => (
            <>
              <Field label="Title">
                <TextInput
                  value={x.title}
                  onChange={(e) => setX({ title: e.target.value })}
                />
              </Field>
              <Field label="Company">
                <TextInput
                  value={x.company}
                  onChange={(e) => setX({ company: e.target.value })}
                />
              </Field>
              <Field label="Company link">
                <TextInput
                  value={x.url ?? ""}
                  placeholder="https://"
                  onChange={(e) => setX({ url: e.target.value })}
                />
              </Field>
              <Field label="Start" hint="YYYY-MM">
                <TextInput
                  value={x.start}
                  onChange={(e) => setX({ start: e.target.value })}
                />
              </Field>
              <Field label="End" hint="YYYY-MM or Present">
                <TextInput
                  value={x.end}
                  onChange={(e) => setX({ end: e.target.value })}
                />
              </Field>
              <Field label="Location" className="sm:col-span-2">
                <TextInput
                  value={x.location}
                  onChange={(e) => setX({ location: e.target.value })}
                />
              </Field>
              <Field
                label="Highlights"
                hint="One per line · **bold**, *italic*, [text](https://link)"
                className="sm:col-span-2"
              >
                <LinesInput
                  value={x.highlights ?? []}
                  onChange={(highlights) => setX({ highlights })}
                />
              </Field>
            </>
          )}
        />
      </Block>

      <Block id="projects" title="Projects">
        <ListEditor
          items={profile.projects}
          onChange={(v) => set("projects", v)}
          make={() => ({
            name: "",
            subtitle: "",
            description: "",
            highlights: [],
            tech: [],
            url: "",
          })}
          title={(x) => x.name}
          addLabel="Add project"
          render={(x, setX) => (
            <>
              <Field label="Name">
                <TextInput
                  value={x.name}
                  onChange={(e) => setX({ name: e.target.value })}
                />
              </Field>
              <Field label="Subtitle" className="sm:col-span-2">
                <TextInput
                  value={x.subtitle ?? ""}
                  placeholder="Client, context or role"
                  onChange={(e) => setX({ subtitle: e.target.value })}
                />
              </Field>
              <Field label="Link">
                <TextInput
                  value={x.url}
                  placeholder="https://"
                  onChange={(e) => setX({ url: e.target.value })}
                />
              </Field>
              <Field
                label="Tech"
                hint="Comma separated"
                className="sm:col-span-2"
              >
                <CommaInput
                  value={x.tech}
                  placeholder="React, Next.js"
                  onChange={(tech) => setX({ tech })}
                />
              </Field>
              <Field
                label="Description"
                hint="**bold**, *italic*, [text](https://link)"
                className="sm:col-span-2"
              >
                <Textarea
                  rows={3}
                  value={x.description}
                  onChange={(e) => setX({ description: e.target.value })}
                />
              </Field>
              <Field
                label="Highlights"
                hint="One per line · **bold**, *italic*, [text](https://link)"
                className="sm:col-span-2"
              >
                <LinesInput
                  value={x.highlights ?? []}
                  onChange={(highlights) => setX({ highlights })}
                />
              </Field>
            </>
          )}
        />
      </Block>

      <Block id="education" title="Education">
        <ListEditor
          items={profile.education}
          onChange={(v) => set("education", v)}
          make={() => ({
            school: "",
            degree: "",
            field: "",
            start: "",
            end: "",
            location: "",
            details: [],
          })}
          title={(x) => [x.degree, x.school].filter(Boolean).join(" · ")}
          addLabel="Add education"
          render={(x, setX) => (
            <>
              <Field label="School" className="sm:col-span-2">
                <TextInput
                  value={x.school}
                  onChange={(e) => setX({ school: e.target.value })}
                />
              </Field>
              <Field label="Degree">
                <TextInput
                  value={x.degree}
                  onChange={(e) => setX({ degree: e.target.value })}
                />
              </Field>
              <Field label="Field of study">
                <TextInput
                  value={x.field}
                  onChange={(e) => setX({ field: e.target.value })}
                />
              </Field>
              <Field label="Location" className="sm:col-span-2">
                <TextInput
                  value={x.location ?? ""}
                  onChange={(e) => setX({ location: e.target.value })}
                />
              </Field>
              <Field label="Start">
                <TextInput
                  value={x.start}
                  onChange={(e) => setX({ start: e.target.value })}
                />
              </Field>
              <Field label="End">
                <TextInput
                  value={x.end}
                  onChange={(e) => setX({ end: e.target.value })}
                />
              </Field>
              <Field
                label="Details"
                hint="One per line, e.g. grade or honours"
                className="sm:col-span-2"
              >
                <LinesInput
                  value={x.details ?? []}
                  onChange={(details) => setX({ details })}
                />
              </Field>
            </>
          )}
        />
      </Block>

      <Block id="skills" title="Skills">
        <ListEditor
          items={profile.skills}
          onChange={(v) => set("skills", v)}
          make={() => ({ group: "", items: [] })}
          title={(x) => x.group}
          addLabel="Add skill group"
          render={(x, setX) => (
            <>
              <Field label="Group" hint="Leave empty for a plain list">
                <TextInput
                  value={x.group}
                  placeholder="Frameworks (optional)"
                  onChange={(e) => setX({ group: e.target.value })}
                />
              </Field>
              <Field label="Skills" hint="Comma separated">
                <CommaInput
                  value={x.items}
                  placeholder="React, Next.js, Vue"
                  onChange={(items) => setX({ items })}
                />
              </Field>
            </>
          )}
        />
      </Block>

      <Block id="certifications" title="Certifications">
        <ListEditor
          items={profile.certifications}
          onChange={(v) => set("certifications", v)}
          make={() => ({ name: "", issuer: "", year: "", url: "" })}
          title={(x) => x.name}
          addLabel="Add certification"
          render={(x, setX) => (
            <>
              <Field label="Name" className="sm:col-span-2">
                <TextInput
                  value={x.name}
                  onChange={(e) => setX({ name: e.target.value })}
                />
              </Field>
              <Field label="Issuer">
                <TextInput
                  value={x.issuer}
                  onChange={(e) => setX({ issuer: e.target.value })}
                />
              </Field>
              <Field label="Year">
                <TextInput
                  value={x.year}
                  onChange={(e) => setX({ year: e.target.value })}
                />
              </Field>
              <Field label="Link" className="sm:col-span-2">
                <TextInput
                  value={x.url ?? ""}
                  placeholder="https://"
                  onChange={(e) => setX({ url: e.target.value })}
                />
              </Field>
            </>
          )}
        />
      </Block>

      {showExtra && (
        <Block
          id="extra"
          title="Extra context"
          description="Anything the AI should know that isn't on your resume: notice period, preferred roles, visa status, what you're proud of. Never shown to employers."
        >
          <Textarea
            rows={5}
            value={profile.extra}
            onChange={(e) => set("extra", e.target.value)}
          />
        </Block>
      )}
    </>
  );
}

export function Block({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-base font-medium">{title}</h2>
      {description && (
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

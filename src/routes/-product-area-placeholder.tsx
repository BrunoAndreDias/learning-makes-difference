import type { ReactNode } from "react";

type PlaceholderSection = {
  description: string;
  title: string;
};

type ProductAreaPlaceholderProps = {
  description: string;
  heading: string;
  intro: string;
  sections: PlaceholderSection[];
  summary: ReactNode;
};

export function ProductAreaPlaceholder({
  description,
  heading,
  intro,
  sections,
  summary,
}: Readonly<ProductAreaPlaceholderProps>) {
  return (
    <section className="stack">
      <article className="card stack panel-protected">
        <p className="section-label">Protected route</p>
        <h3>{heading}</h3>
        <p>{description}</p>
      </article>

      <div className="placeholder-grid">
        <article className="card stack">
          <p className="section-label">Overview</p>
          <p>{intro}</p>
          <div className="tag-row">
            {sections.map((section) => (
              <span key={section.title} className="tag">
                {section.title}
              </span>
            ))}
          </div>
        </article>

        <article className="card stack">
          <p className="section-label">Next slice</p>
          <ul className="placeholder-list">
            {sections.map((section) => (
              <li key={section.title}>
                <strong>{section.title}</strong>
                <p>{section.description}</p>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="card stack">
        <p className="section-label">Layout check</p>
        {summary}
      </article>
    </section>
  );
}

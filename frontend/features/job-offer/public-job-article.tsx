/**
 * Article d'une offre (présentation pure, sans `"use client"`) : même rendu
 * pour la fiche publique et la prévisualisation recruteur. L'appelant
 * construit le modèle (labels déjà résolus) — ce composant ne fetch rien.
 */
export type PublicJobArticleModel = {
  companyName: string | null;
  title: string;
  meta: string[];
  description: string | null;
  skills: { id: string; name: string | null; requirementType: string }[];
  languages: { id: string; name: string | null; level: string }[];
  degreeLabels: string[];
  studyFieldLabels: string[];
};

export function PublicJobArticle({ article }: { article: PublicJobArticleModel }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-12 lg:py-16">
      <header className="border-b border-slate-border pb-6">
        {article.companyName ? (
          <p className="font-label-md text-label-md text-text-secondary">{article.companyName}</p>
        ) : null}
        <h1 className="mt-1 font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
          {article.title}
        </h1>
        {article.meta.length > 0 ? (
          <p className="mt-2 text-body-md font-body-md text-text-secondary">
            {article.meta.join(" · ")}
          </p>
        ) : null}
      </header>

      {article.description ? (
        <section className="mt-8">
          <div
            className="job-offer-description text-body-md font-body-md text-text-primary"
            // HTML déjà sanitisé côté serveur/base (D19) — jamais de HTML cru.
            dangerouslySetInnerHTML={{ __html: article.description }}
          />
        </section>
      ) : null}

      {article.skills.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold">
            Skills
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {article.skills.map((skill) => (
              <li
                key={skill.id}
                className="px-2.5 py-1 rounded-full text-label-md font-label-md bg-canvas-white text-text-primary shadow-sm"
              >
                {skill.name ?? "Unknown skill"}
                {skill.requirementType === "mandatory" ? (
                  <span className="ml-1.5 text-text-secondary">· required</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {article.languages.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold">
            Languages
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {article.languages.map((language) => (
              <li
                key={language.id}
                className="px-2.5 py-1 rounded-full text-label-md font-label-md bg-canvas-white text-text-primary shadow-sm"
              >
                {language.name ?? "Unknown language"} · {language.level}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {article.degreeLabels.length > 0 || article.studyFieldLabels.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold">
            Education
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {[...article.degreeLabels, ...article.studyFieldLabels].map((label) => (
              <li
                key={label}
                className="px-2.5 py-1 rounded-full text-label-md font-label-md bg-canvas-white text-text-primary shadow-sm"
              >
                {label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

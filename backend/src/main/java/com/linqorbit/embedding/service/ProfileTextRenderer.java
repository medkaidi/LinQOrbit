package com.linqorbit.embedding.service;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

import org.springframework.stereotype.Component;

import com.linqorbit.candidate.entity.NormalizationSourceType;
import com.linqorbit.embedding.exception.EmbeddingNotRenderableException;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

/**
 * Rendu texte déterministe d'une fiche normalisée (stratégie {@value #STRATEGY_VERSION},
 * SPEC §8.4.4) : même fiche → même texte → même vecteur, sans LLM, sans rien
 * inventer — chaque ligne est une valeur du JSON.
 *
 * <p>Candidat et offre sont rendus avec le <b>même vocabulaire de rubriques</b>
 * (titre, séniorité, compétences, langues, formations, certifications…) pour
 * que les deux côtés tombent dans le même espace sémantique. Ce qui décrit
 * l'<b>identité</b> plutôt que la capacité est volontairement écarté : noms
 * d'employeurs et d'établissements, URL, dates, rémunération, avantages,
 * argumentaire de la société, description brute de l'offre (dupliquée par le
 * résumé et les responsabilités). Les rubriques sont ordonnées de la plus à la
 * moins discriminante : si le plafond de taille est atteint, c'est la fin qui
 * est coupée.</p>
 *
 * <p>Tolérant aux fiches anciennes ou partielles : un champ absent, nul ou
 * vide est ignoré. Modifier ce rendu impose de bumper {@link #STRATEGY_VERSION}
 * (les vecteurs de l'ancienne stratégie sont conservés, jamais mélangés).</p>
 */
@Component
@RequiredArgsConstructor
public class ProfileTextRenderer {

    /** Version de la stratégie de rendu, portée par chaque embedding et chaque job. */
    public static final String STRATEGY_VERSION = "text-1";

    /** Plafond de caractères (le service IA refuse au-delà de 32 000). */
    static final int MAX_CHARS = 24_000;

    private final ObjectMapper objectMapper;

    /** Rend la fiche ; {@link EmbeddingNotRenderableException} si rien n'est représentable. */
    public String render(String contentJson, NormalizationSourceType sourceType) {
        JsonNode content = parse(contentJson);
        List<String> lines = new ArrayList<>();
        if (sourceType == NormalizationSourceType.OFFER) {
            renderOffer(content, lines);
        } else {
            renderCandidate(content, lines);
        }
        if (lines.isEmpty()) {
            throw new EmbeddingNotRenderableException("The normalized profile has nothing to embed.");
        }
        return capped(sourceType == NormalizationSourceType.OFFER ? "Job offer" : "Candidate profile", lines);
    }

    private JsonNode parse(String contentJson) {
        if (contentJson == null || contentJson.isBlank()) {
            throw new EmbeddingNotRenderableException("The normalized profile has no content.");
        }
        try {
            JsonNode root = objectMapper.readTree(contentJson);
            if (root == null || !root.isObject()) {
                throw new EmbeddingNotRenderableException("The normalized profile is not a JSON object.");
            }
            return root;
        } catch (JacksonException ex) {
            throw new EmbeddingNotRenderableException("The normalized profile is not valid JSON.");
        }
    }

    // --- candidat ---------------------------------------------------------------

    private void renderCandidate(JsonNode c, List<String> out) {
        field(out, "Title", text(c, "title"));
        field(out, "Seniority", text(c, "seniority"));
        field(out, "Years of experience", number(c, "yearsOfExperience"));
        field(out, "Target role", text(c, "targetRole"));
        field(out, "Location", location(c.path("location")));
        field(out, "Summary", text(c, "summary"));
        section(out, "Skills", c.path("skills"), this::candidateSkill);
        section(out, "Experience", c.path("experiences"), this::candidateExperience);
        section(out, "Projects", c.path("projects"), this::candidateProject);
        section(out, "Education", c.path("diplomas"), this::diploma);
        section(out, "Languages", c.path("languages"), this::language);
        section(out, "Certifications", c.path("certifications"), this::certification);
    }

    private String candidateSkill(JsonNode s) {
        return named(text(s, "name"), text(s, "category"), labelled("level", number(s, "level")),
                labelled("years", number(s, "yearsExperience")));
    }

    private String candidateExperience(JsonNode e) {
        String head = named(text(e, "positionTitle"), text(e, "domain"));
        if (head == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder(head);
        append(sb, "Responsibilities", strings(e.path("responsibilities")));
        append(sb, "Technologies", strings(e.path("technologies")));
        append(sb, "Achievements", strings(e.path("achievements")));
        return sb.toString();
    }

    private String candidateProject(JsonNode p) {
        String head = named(text(p, "name"), text(p, "role"), text(p, "domain"));
        if (head == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder(head);
        append(sb, "Responsibilities", strings(p.path("responsibilities")));
        append(sb, "Technologies", strings(p.path("technologies")));
        append(sb, "Achievements", strings(p.path("achievements")));
        return sb.toString();
    }

    private String diploma(JsonNode d) {
        return named(text(d, "title"), text(d, "degreeLabel"), text(d, "studyFieldLabel"));
    }

    private String language(JsonNode l) {
        return named(text(l, "name"), text(l, "level"));
    }

    private String certification(JsonNode c) {
        return text(c, "name");
    }

    // --- offre ------------------------------------------------------------------

    private void renderOffer(JsonNode o, List<String> out) {
        field(out, "Title", text(o, "title"));
        field(out, "Also known as", join(strings(o.path("alternateTitles"))));
        field(out, "Domain", text(o, "domain"));
        field(out, "Seniority", text(o, "seniority"));
        field(out, "Contract type", text(o, "contractType"));
        field(out, "Work mode", text(o, "workMode"));
        field(out, "Location", location(o.path("location")));
        field(out, "Required years of experience", number(o, "requiredYears"));
        field(out, "Summary", text(o, "summary"));
        section(out, "Required skills", o.path("requiredSkills"), this::offerSkill);
        section(out, "Preferred skills", o.path("preferredSkills"), this::offerSkill);
        section(out, "Responsibilities", o.path("responsibilities"), this::offerResponsibility);
        section(out, "Education", o.path("requiredDegrees"), this::requirementEntry);
        section(out, "Study fields", o.path("requiredStudyFields"), this::requirementEntry);
        section(out, "Languages", o.path("languages"), this::offerLanguage);
        section(out, "Certifications", o.path("certifications"), this::certification);
    }

    private String offerSkill(JsonNode s) {
        return named(text(s, "name"), text(s, "category"), labelled("level", number(s, "level")),
                labelled("min years", number(s, "minYears")));
    }

    private String offerResponsibility(JsonNode r) {
        String text = text(r, "text");
        if (text == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder(text);
        append(sb, "Technologies", strings(r.path("technologies")));
        return sb.toString();
    }

    private String requirementEntry(JsonNode e) {
        return text(e, "label");
    }

    private String offerLanguage(JsonNode l) {
        String requirement = l.path("required").isBoolean() && !l.path("required").asBoolean()
                ? "preferred" : null;
        return named(text(l, "name"), text(l, "level"), requirement);
    }

    // --- primitives -------------------------------------------------------------

    private static void field(List<String> out, String label, String value) {
        if (value != null) {
            out.add(label + ": " + value);
        }
    }

    private static void section(List<String> out, String label, JsonNode array,
            Function<JsonNode, String> renderer) {
        if (!array.isArray()) {
            return;
        }
        List<String> items = new ArrayList<>();
        for (JsonNode item : array) {
            if (item.isObject()) {
                String rendered = renderer.apply(item);
                if (rendered != null) {
                    items.add("- " + rendered);
                }
            }
        }
        if (!items.isEmpty()) {
            out.add(label + ":");
            out.addAll(items);
        }
    }

    private static void append(StringBuilder sb, String label, List<String> values) {
        if (!values.isEmpty()) {
            sb.append("; ").append(label).append(": ").append(String.join(", ", values));
        }
    }

    /** «nom (détail, détail)» ; null si le nom manque. */
    private static String named(String name, String... details) {
        if (name == null) {
            return null;
        }
        List<String> kept = new ArrayList<>();
        for (String detail : details) {
            if (detail != null) {
                kept.add(detail);
            }
        }
        return kept.isEmpty() ? name : name + " (" + String.join(", ", kept) + ")";
    }

    private static String labelled(String label, String value) {
        return value == null ? null : label + " " + value;
    }

    private static String join(List<String> values) {
        return values.isEmpty() ? null : String.join(", ", values);
    }

    private static String location(JsonNode location) {
        String city = text(location, "city");
        String country = text(location, "country");
        if (city == null) {
            return country;
        }
        return country == null ? city : city + ", " + country;
    }

    private static String text(JsonNode parent, String field) {
        JsonNode value = parent.path(field);
        if (!value.isString()) {
            return null;
        }
        String trimmed = value.asString().strip();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String number(JsonNode parent, String field) {
        JsonNode value = parent.path(field);
        return value.isNumber() ? value.asString() : null;
    }

    private static List<String> strings(JsonNode array) {
        List<String> values = new ArrayList<>();
        if (array.isArray()) {
            for (JsonNode item : array) {
                if (item.isString() && !item.asString().isBlank()) {
                    values.add(item.asString().strip());
                }
            }
        }
        return values;
    }

    /** Titre + lignes ; au plafond, la fin est coupée (jamais le début, le plus discriminant). */
    private static String capped(String heading, List<String> lines) {
        StringBuilder sb = new StringBuilder(heading);
        for (String line : lines) {
            int remaining = MAX_CHARS - sb.length() - 1;
            if (remaining <= 0) {
                break;
            }
            sb.append('\n').append(line.length() > remaining ? line.substring(0, remaining) : line);
        }
        return sb.toString();
    }
}

package com.linqorbit.joboffer.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;

import tools.jackson.databind.JsonNode;

/**
 * Filtres de la liste des offres du recruteur (T-70) sur PostgreSQL réel. La
 * liste étant bornée aux sociétés du recruteur de test, les totaux sont exacts
 * (aucun delta sur la base partagée). Chaque entrée facultative est vérifiée
 * renseignée / vide / absente / invalide, et la société d'un autre recruteur
 * ne fuit jamais.
 */
@SpringBootTest
@AutoConfigureMockMvc
class JobOfferListFiltersIntegrationTest extends JobOfferSearchTestSupport {

    private Owner recruiter;
    private Owner foreign;
    private UUID companyA;
    private UUID companyB;

    private static final String BACKEND = "Backend Dev";
    private static final String FRONTEND = "Frontend Dev";
    private static final String DATA = "Data Engineer";
    private static final String OPS = "Ops Dev";
    private static final String OLD = "Old Dev";
    private static final String LATE = "Late Dev";
    private static final String PLATFORM = "Platform Engineer";
    private static final String PERCENT = "Percent% Match";
    private static final String UNDERSCORE = "Under_score Match";
    private static final String FOREIGN = "Foreign Dev";

    /** Du plus récemment créé au plus ancien : les listes attendues suivent cet ordre. */
    private static final List<String> ALL = List.of(UNDERSCORE, PERCENT, PLATFORM, LATE, OLD, OPS, DATA, FRONTEND,
            BACKEND);

    @BeforeEach
    void seed() throws Exception {
        LocalDate today = LocalDate.now();
        recruiter = owner("Acme");
        companyA = recruiter.companyId();
        companyB = createCompany(recruiter.token(), "Globex");

        offer(recruiter, companyA, BACKEND, Spec.published(100).seniority(SENIOR));
        offer(recruiter, companyA, FRONTEND, Spec.published(90).status(DRAFT).seniority(JUNIOR).workMode(HYBRID)
                .employment(PART_TIME).country("DE").expiresAt(today.plusDays(10)));
        offer(recruiter, companyA, DATA, Spec.published(80).status(VALIDATED).seniority(LEAD)
                .contract(FIXED_TERM).expiresAt(today.plusDays(30)));
        offer(recruiter, companyA, OPS, Spec.published(70).status(CLOSED).workMode(ON_SITE).contract(FIXED_TERM)
                .employment(PART_TIME).country("ES").expiresAt(today.minusDays(1)));
        offer(recruiter, companyA, OLD, Spec.published(60).expiresAt(today.minusDays(30)));
        offer(recruiter, companyA, LATE, Spec.published(50).expiresAt(today.plusDays(31)));
        offer(recruiter, companyB, PLATFORM, Spec.published(40).workMode(ON_SITE).country("ES").expiresAt(today));
        offer(recruiter, companyB, PERCENT, Spec.published(30).status(DRAFT).workMode(ON_SITE).country("ES"));
        offer(recruiter, companyB, UNDERSCORE, Spec.published(20).workMode(ON_SITE).country("ES"));

        foreign = owner("Initech");
        offer(foreign, foreign.companyId(), FOREIGN, Spec.published(10));
    }

    private JsonNode list(Owner who, String... params) throws Exception {
        var request = get("/api/v1/job-offers").header("Authorization", "Bearer " + who.token());
        for (int i = 0; i < params.length; i += 2) {
            request = request.param(params[i], params[i + 1]);
        }
        return ok(request);
    }

    private List<String> titles(String... params) throws Exception {
        return titlesOf(list(recruiter, params));
    }

    // --- nominal, vide ≡ absent ------------------------------------------------------------------

    @Test
    void sansParametreListeToutesLesOffresDesSocietesDuRecruteurLesPlusRecentesEnPremier() throws Exception {
        JsonNode page = list(recruiter);

        assertThat(titlesOf(page)).containsExactlyElementsOf(ALL);
        assertThat(page.get("total").asLong()).isEqualTo(9);
        assertThat(titlesOf(page)).doesNotContain(FOREIGN);
    }

    @Test
    void lesParametresVidesEquivalentAuxParametresAbsents() throws Exception {
        JsonNode page = list(recruiter, "q", "", "status", "", "workModeId", "", "contractTypeId", "",
                "employmentTypeId", "", "seniority", "", "companyId", "", "expiry", "");

        assertThat(titlesOf(page)).containsExactlyElementsOf(ALL);
        assertThat(page.get("total").asLong()).isEqualTo(9);
        assertThat(titles("q", "   ")).containsExactlyElementsOf(ALL);
    }

    // --- chaque filtre ---------------------------------------------------------------------------

    @Test
    void leStatutFiltreEtIgnoreLaCasse() throws Exception {
        assertThat(titles("status", "draft")).containsExactly(PERCENT, FRONTEND);
        assertThat(titles("status", "published")).containsExactly(UNDERSCORE, PLATFORM, LATE, OLD, BACKEND);
        assertThat(titles("status", "validated")).containsExactly(DATA);
        assertThat(titles("status", "closed")).containsExactly(OPS);
        assertThat(titles("status", " PUBLISHED ")).containsExactly(UNDERSCORE, PLATFORM, LATE, OLD, BACKEND);
    }

    @Test
    void lesVocabulairesFiltrent() throws Exception {
        assertThat(titles("workModeId", REMOTE.toString())).containsExactly(LATE, OLD, DATA, BACKEND);
        assertThat(titles("workModeId", HYBRID.toString())).containsExactly(FRONTEND);
        assertThat(titles("workModeId", ON_SITE.toString())).containsExactly(UNDERSCORE, PERCENT, PLATFORM, OPS);
        assertThat(titles("contractTypeId", FIXED_TERM.toString())).containsExactly(OPS, DATA);
        assertThat(titles("employmentTypeId", PART_TIME.toString())).containsExactly(OPS, FRONTEND);
    }

    @Test
    void laSenioriteFiltreEtIgnoreLaCase() throws Exception {
        assertThat(titles("seniority", "senior")).containsExactly(BACKEND);
        assertThat(titles("seniority", " Junior ")).containsExactly(FRONTEND);
        assertThat(titles("seniority", "LEAD")).containsExactly(DATA);
        assertThat(titles("seniority", "mid")).containsExactly(UNDERSCORE, PERCENT, PLATFORM, LATE, OLD, OPS);
        assertThat(titles("seniority", "principal")).isEmpty();
    }

    @Test
    void laSocieteRestreintAUneDesSocietesDuRecruteur() throws Exception {
        assertThat(titles("companyId", companyA.toString()))
                .containsExactly(LATE, OLD, OPS, DATA, FRONTEND, BACKEND);
        assertThat(titles("companyId", companyB.toString())).containsExactly(UNDERSCORE, PERCENT, PLATFORM);
    }

    @Test
    void lEcheanceExpireeEtProcheRespectentLesBornes() throws Exception {
        // Expirée : strictement avant aujourd'hui, sans échéance jamais retenue.
        assertThat(titles("expiry", "expired")).containsExactly(OLD, OPS);
        // Proche : aujourd'hui et +30 jours inclus ; +31 jours, passé et sans échéance exclus.
        assertThat(titles("expiry", "expiringSoon")).containsExactly(PLATFORM, DATA, FRONTEND);
        assertThat(titles("expiry", " EXPIRINGSOON ")).containsExactly(PLATFORM, DATA, FRONTEND);
    }

    @Test
    void laRechercheCibleLeTitreSansCasseEtSansJokers() throws Exception {
        assertThat(titles("q", "backend")).containsExactly(BACKEND);
        assertThat(titles("q", "  DEV ")).containsExactly(LATE, OLD, OPS, FRONTEND, BACKEND);
        // Jokers saisis : littéraux, jamais « tout ».
        assertThat(titles("q", "%")).containsExactly(PERCENT);
        assertThat(titles("q", "_")).containsExactly(UNDERSCORE);
        assertThat(titles("q", "t%")).containsExactly(PERCENT);
        assertThat(titles("q", "introuvable")).isEmpty();
    }

    @Test
    void lesFiltresSeCombinentParEt() throws Exception {
        assertThat(titles("status", "published", "workModeId", ON_SITE.toString()))
                .containsExactly(UNDERSCORE, PLATFORM);
        assertThat(titles("status", "published", "seniority", "mid", "expiry", "expired")).containsExactly(OLD);
        assertThat(titles("companyId", companyA.toString(), "q", "dev", "status", "published"))
                .containsExactly(LATE, OLD, BACKEND);
        assertThat(titles("status", "closed", "workModeId", REMOTE.toString())).isEmpty();
    }

    // --- isolation entre recruteurs --------------------------------------------------------------

    @Test
    void laSocieteDUnAutreRecruteurOuInconnueDonneUnePageVide() throws Exception {
        for (UUID notMine : List.of(foreign.companyId(), UUID.randomUUID())) {
            JsonNode page = list(recruiter, "companyId", notMine.toString());
            assertThat(page.get("items")).isEmpty();
            assertThat(page.get("total").asLong()).isZero();
        }
    }

    @Test
    void unRecruteurNeVoitJamaisLesOffresDUneSocieteQuiNeLuiAppartientPas() throws Exception {
        assertThat(titlesOf(list(foreign))).containsExactly(FOREIGN);
        // Même en visant la société d'un autre : rien.
        assertThat(list(foreign, "companyId", companyA.toString()).get("total").asLong()).isZero();
        assertThat(titlesOf(list(foreign, "q", "dev"))).containsExactly(FOREIGN);
    }

    // --- pagination ------------------------------------------------------------------------------

    @Test
    void leTotalEstLeTotalFiltreSurPagePleineIncompleteEtHorsPlage() throws Exception {
        // Page pleine (count), page incomplète (total déduit), page vide hors plage (count).
        JsonNode first = list(recruiter, "size", "2");
        assertThat(titlesOf(first)).containsExactly(UNDERSCORE, PERCENT);
        assertThat(first.get("total").asLong()).isEqualTo(9);

        JsonNode last = list(recruiter, "size", "2", "page", "4");
        assertThat(titlesOf(last)).containsExactly(BACKEND);
        assertThat(last.get("total").asLong()).isEqualTo(9);

        JsonNode beyond = list(recruiter, "size", "2", "page", "5");
        assertThat(beyond.get("items")).isEmpty();
        assertThat(beyond.get("total").asLong()).isEqualTo(9);

        JsonNode filtered = list(recruiter, "size", "2", "status", "published", "page", "1");
        assertThat(titlesOf(filtered)).containsExactly(LATE, OLD);
        assertThat(filtered.get("total").asLong()).isEqualTo(5);
    }

    @Test
    void lOrdreResteStableQuandDeuxOffresOntLaMemeDateDeCreation() throws Exception {
        jdbcTemplate.update("""
                UPDATE job_offer SET created_at = (SELECT created_at FROM job_offer WHERE title = ? AND company_id = ?)
                WHERE title = ? AND company_id = ?""", DATA, companyA, FRONTEND, companyA);

        List<String> viaPages = new ArrayList<>();
        for (int page = 0; page < 9; page++) {
            viaPages.addAll(titlesOf(list(recruiter, "size", "1", "page", String.valueOf(page))));
        }

        assertThat(viaPages).hasSize(9).doesNotHaveDuplicates().containsExactlyInAnyOrderElementsOf(ALL);
        assertThat(viaPages).containsExactlyElementsOf(titles());
    }

    // --- entrées invalides -----------------------------------------------------------------------

    @Test
    void lesValeursNonSupporteesRenvoientUn400SansEcho() throws Exception {
        for (String[] invalid : new String[][] {
                {"status", "archived"}, {"seniority", "expert"}, {"expiry", "soon"}}) {
            mockMvc.perform(get("/api/v1/job-offers").header("Authorization", "Bearer " + recruiter.token())
                            .param(invalid[0], invalid[1]))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Unsupported filter value"))
                    .andExpect(jsonPath("$.detail")
                            .value("The '" + invalid[0] + "' filter has an unsupported value."));
        }
    }

    @Test
    void unIdentifiantMalformeRenvoieLeMessageGenerique() throws Exception {
        for (String name : List.of("workModeId", "contractTypeId", "employmentTypeId", "companyId")) {
            mockMvc.perform(get("/api/v1/job-offers").header("Authorization", "Bearer " + recruiter.token())
                            .param(name, "not-a-uuid"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.detail").value("The request could not be processed."));
        }
    }

    @Test
    void sansJetonLaListeRefuse() throws Exception {
        mockMvc.perform(get("/api/v1/job-offers").param("status", "draft"))
                .andExpect(status().isUnauthorized());
    }
}

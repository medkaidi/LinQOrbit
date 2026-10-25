package com.linqorbit.joboffer.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.JsonNode;

import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.repository.JobOfferRow;
import com.linqorbit.joboffer.repository.JobOfferSearch;
import com.linqorbit.joboffer.repository.JobOfferSearchRepository;

/**
 * Recherche et filtres de la liste admin des offres (T-110) sur PostgreSQL
 * réel. La liste admin est <b>globale</b> sur une base partagée : chaque
 * scénario isole ses offres par un jeton unique présent dans le nom des
 * sociétés (et dans la plupart des titres), puis vérifie chaque entrée
 * facultative renseignée / vide / absente / invalide. Deux offres sortent du
 * lot pour distinguer la recherche par titre de celle par société.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AdminJobOfferFiltersIntegrationTest extends JobOfferSearchTestSupport {

    @Autowired
    private JobOfferSearchRepository searchRepository;

    private final List<UUID> adminIds = new ArrayList<>();

    private String adminToken;
    private String recruiterToken;
    private String token;
    private UUID companyA;
    private UUID companyB;

    private String backend;
    private String frontend;
    private String data;
    private String ops;
    private String old;
    private String late;
    private String platform;
    private String percent;
    private String underscore;
    private String titleOnly;
    private static final String COMPANY_ONLY = "Quiet Role";

    /** Du plus récemment créé au plus ancien. */
    private List<String> all;

    @BeforeEach
    void seed() throws Exception {
        token = uniqueToken();
        backend = "Backend Dev " + token;
        frontend = "Frontend Dev " + token;
        data = "Data Engineer " + token;
        ops = "Ops Dev " + token;
        old = "Old Dev " + token;
        late = "Late Dev " + token;
        platform = "Platform Engineer " + token;
        percent = "Percent% Match " + token;
        underscore = "Under_score Match " + token;
        titleOnly = "Solo Dev " + token;
        all = List.of(titleOnly, COMPANY_ONLY, underscore, percent, platform, late, old, ops, data, frontend,
                backend);

        LocalDate today = LocalDate.now();
        Owner recruiter = owner("Acme " + token);
        recruiterToken = recruiter.token();
        companyA = recruiter.companyId();
        companyB = createCompany(recruiter.token(), "Globex " + token);
        UUID plain = createCompany(recruiter.token(), "Plain Corp");

        offer(recruiter, companyA, backend, Spec.published(100).seniority(SENIOR));
        offer(recruiter, companyA, frontend, Spec.published(90).status(DRAFT).seniority(JUNIOR).workMode(HYBRID)
                .employment(PART_TIME).expiresAt(today.plusDays(10)));
        offer(recruiter, companyA, data, Spec.published(80).status(VALIDATED).seniority(LEAD).contract(FIXED_TERM)
                .expiresAt(today.plusDays(30)));
        offer(recruiter, companyA, ops, Spec.published(70).status(CLOSED).workMode(ON_SITE).contract(FIXED_TERM)
                .employment(PART_TIME).expiresAt(today.minusDays(1)));
        offer(recruiter, companyA, old, Spec.published(60).expiresAt(today.minusDays(30)));
        offer(recruiter, companyA, late, Spec.published(50).expiresAt(today.plusDays(31)));
        offer(recruiter, companyB, platform, Spec.published(40).workMode(ON_SITE).expiresAt(today));
        offer(recruiter, companyB, percent, Spec.published(30).status(DRAFT).workMode(ON_SITE));
        offer(recruiter, companyB, underscore, Spec.published(20).workMode(ON_SITE));
        offer(recruiter, companyA, COMPANY_ONLY, Spec.published(15));
        offer(recruiter, plain, titleOnly, Spec.published(10));

        adminToken = createAdminToken();
    }

    @AfterEach
    void cleanupAdmins() {
        for (UUID id : adminIds) {
            jdbcTemplate.update("DELETE FROM user_roles WHERE user_id = ?", id);
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", id);
        }
        adminIds.clear();
    }

    private JsonNode list(String... params) throws Exception {
        var request = get("/api/v1/admin/job-offers").header("Authorization", "Bearer " + adminToken);
        for (int i = 0; i < params.length; i += 2) {
            request = request.param(params[i], params[i + 1]);
        }
        return ok(request);
    }

    /** Titres de la recherche isolée par le jeton, plus les filtres demandés. */
    private List<String> scoped(String... params) throws Exception {
        List<String> all = new ArrayList<>(List.of("q", token));
        all.addAll(List.of(params));
        return titlesOf(list(all.toArray(String[]::new)));
    }

    /** Titres d'une recherche {@code q} libre (déjà isolée par l'appelant), plus filtres. */
    private List<String> search(String q, String... params) throws Exception {
        List<String> all = new ArrayList<>(List.of("q", q));
        all.addAll(List.of(params));
        return titlesOf(list(all.toArray(String[]::new)));
    }

    // --- nominal, vide ≡ absent ------------------------------------------------------------------

    @Test
    void laRechercheParLeJetonListeToutesLesOffresDeTestLesPlusRecentesEnPremier() throws Exception {
        JsonNode page = list("q", token);

        assertThat(titlesOf(page)).containsExactlyElementsOf(all);
        assertThat(page.get("total").asLong()).isEqualTo(11);
    }

    @Test
    void lesParametresVidesEquivalentAuxParametresAbsents() throws Exception {
        long totalWithout = list().get("total").asLong();

        JsonNode empty = list("q", "", "status", "", "workModeId", "", "contractTypeId", "", "employmentTypeId", "",
                "seniority", "", "expiry", "");

        assertThat(empty.get("total").asLong()).isEqualTo(totalWithout);
        assertThat(totalWithout).isGreaterThanOrEqualTo(11);
        assertThat(scoped("status", "", "workModeId", "", "contractTypeId", "", "employmentTypeId", "",
                "seniority", "", "expiry", "")).containsExactlyElementsOf(all);
        assertThat(list("q", "   ").get("total").asLong()).isEqualTo(totalWithout);
    }

    @Test
    void lesLignesPortentLeNomDeLaSocieteEtAucuneDescription() throws Exception {
        JsonNode page = list("q", token);

        for (JsonNode item : page.get("items")) {
            String title = item.get("title").asText();
            String expectedCompany = title.equals(titleOnly) ? "Plain Corp"
                    : (title.equals(platform) || title.equals(percent) || title.equals(underscore))
                            ? "Globex " + token : "Acme " + token;
            assertThat(item.get("companyName").asText()).as(title).isEqualTo(expectedCompany);
            assertThat(item.has("description")).as(title).isFalse();
        }
        JsonNode first = page.get("items").get(10);
        assertThat(first.get("title").asText()).isEqualTo(backend);
        assertThat(first.get("status").asText()).isEqualTo("published");
        assertThat(first.get("seniority").asText()).isEqualTo("senior");
        assertThat(first.get("workModeId").asText()).isEqualTo(REMOTE.toString());
    }

    // --- chaque filtre ---------------------------------------------------------------------------

    @Test
    void leStatutFiltreEtIgnoreLaCasse() throws Exception {
        assertThat(scoped("status", "draft")).containsExactly(percent, frontend);
        assertThat(scoped("status", "published"))
                .containsExactly(titleOnly, COMPANY_ONLY, underscore, platform, late, old, backend);
        assertThat(scoped("status", "validated")).containsExactly(data);
        assertThat(scoped("status", "closed")).containsExactly(ops);
        assertThat(scoped("status", " PUBLISHED "))
                .containsExactly(titleOnly, COMPANY_ONLY, underscore, platform, late, old, backend);
    }

    @Test
    void lesVocabulairesFiltrent() throws Exception {
        assertThat(scoped("workModeId", REMOTE.toString()))
                .containsExactly(titleOnly, COMPANY_ONLY, late, old, data, backend);
        assertThat(scoped("workModeId", HYBRID.toString())).containsExactly(frontend);
        assertThat(scoped("workModeId", ON_SITE.toString())).containsExactly(underscore, percent, platform, ops);
        assertThat(scoped("contractTypeId", FIXED_TERM.toString())).containsExactly(ops, data);
        assertThat(scoped("employmentTypeId", PART_TIME.toString())).containsExactly(ops, frontend);
    }

    @Test
    void laSenioriteFiltreEtIgnoreLaCasse() throws Exception {
        assertThat(scoped("seniority", "senior")).containsExactly(backend);
        assertThat(scoped("seniority", " Junior ")).containsExactly(frontend);
        assertThat(scoped("seniority", "LEAD")).containsExactly(data);
        assertThat(scoped("seniority", "mid"))
                .containsExactly(titleOnly, COMPANY_ONLY, underscore, percent, platform, late, old, ops);
        assertThat(scoped("seniority", "principal")).isEmpty();
    }

    @Test
    void lEcheanceExpireeEtProcheRespectentLesBornes() throws Exception {
        // Expirée : strictement avant aujourd'hui, sans échéance jamais retenue.
        assertThat(scoped("expiry", "expired")).containsExactly(old, ops);
        // Proche : aujourd'hui et +30 jours inclus ; +31 jours, passé et sans échéance exclus.
        assertThat(scoped("expiry", "expiringSoon")).containsExactly(platform, data, frontend);
        assertThat(scoped("expiry", " EXPIRINGSOON ")).containsExactly(platform, data, frontend);
    }

    // --- recherche texte -------------------------------------------------------------------------

    @Test
    void laRechercheCibleLeTitreEtLeNomDeLaSocieteSansCasse() throws Exception {
        // Titre seul : la société « Plain Corp » ne porte pas le jeton.
        assertThat(search("solo dev " + token)).containsExactly(titleOnly);
        assertThat(search("BACKEND DEV " + token.toUpperCase())).containsExactly(backend);
        assertThat(search("  backend dev " + token + "  ")).containsExactly(backend);
        // Société seule : « Quiet Role » ne porte pas le jeton dans son titre.
        assertThat(search("acme " + token)).containsExactly(COMPANY_ONLY, late, old, ops, data, frontend, backend);
        assertThat(search("GLOBEX " + token)).containsExactly(underscore, percent, platform);
        assertThat(search("introuvable " + token)).isEmpty();
    }

    @Test
    void lesJokersSaisisSontDesLitteraux() throws Exception {
        assertThat(search("percent% match " + token)).containsExactly(percent);
        assertThat(search("under_score match " + token)).containsExactly(underscore);
        // Un joker qui serait interprété ferait correspondre ces motifs ; littéraux, rien.
        assertThat(search("percen%match " + token)).isEmpty();
        assertThat(search("perc_nt% match " + token)).isEmpty();
        assertThat(search("%")).doesNotContain(backend, frontend);
    }

    @Test
    void laRechercheEstBorneeACentCaracteres() throws Exception {
        String prefix = "backend dev " + token;
        String padded = prefix + " ".repeat(100 - prefix.length()) + "zzzzzzzzzz";
        assertThat(padded.length()).isGreaterThan(100);

        // Au-delà de 100 caractères le surplus est ignoré : l'offre est quand même trouvée.
        assertThat(search(padded)).containsExactly(backend);
    }

    // --- combinaisons et pagination --------------------------------------------------------------

    @Test
    void lesFiltresSeCombinentParEt() throws Exception {
        assertThat(scoped("status", "published", "workModeId", ON_SITE.toString()))
                .containsExactly(underscore, platform);
        assertThat(scoped("status", "published", "seniority", "mid", "expiry", "expired")).containsExactly(old);
        assertThat(search("acme " + token, "status", "published"))
                .containsExactly(COMPANY_ONLY, late, old, backend);
        assertThat(scoped("status", "closed", "workModeId", REMOTE.toString())).isEmpty();
    }

    @Test
    void leTotalEstLeTotalFiltreSurPagePleineIncompleteEtHorsPlage() throws Exception {
        // Page pleine (count), page incomplète (total déduit), page vide hors plage (count).
        JsonNode first = list("q", token, "size", "2");
        assertThat(titlesOf(first)).containsExactly(titleOnly, COMPANY_ONLY);
        assertThat(first.get("total").asLong()).isEqualTo(11);

        JsonNode last = list("q", token, "size", "2", "page", "5");
        assertThat(titlesOf(last)).containsExactly(backend);
        assertThat(last.get("total").asLong()).isEqualTo(11);

        JsonNode beyond = list("q", token, "size", "2", "page", "6");
        assertThat(beyond.get("items")).isEmpty();
        assertThat(beyond.get("total").asLong()).isEqualTo(11);

        JsonNode filtered = list("q", token, "size", "2", "status", "published", "page", "1");
        assertThat(titlesOf(filtered)).containsExactly(underscore, platform);
        assertThat(filtered.get("total").asLong()).isEqualTo(7);

        JsonNode none = list("q", token, "status", "closed", "workModeId", REMOTE.toString());
        assertThat(none.get("items")).isEmpty();
        assertThat(none.get("total").asLong()).isZero();
    }

    @Test
    void lOrdreResteStableQuandDeuxOffresOntLaMemeDateDeCreation() throws Exception {
        jdbcTemplate.update("""
                UPDATE job_offer SET created_at = (SELECT created_at FROM job_offer WHERE title = ? AND company_id = ?)
                WHERE title = ? AND company_id = ?""", data, companyA, frontend, companyA);

        List<String> viaPages = new ArrayList<>();
        for (int page = 0; page < 11; page++) {
            viaPages.addAll(titlesOf(list("q", token, "size", "1", "page", String.valueOf(page))));
        }

        assertThat(viaPages).hasSize(11).doesNotHaveDuplicates().containsExactlyInAnyOrderElementsOf(all);
        assertThat(viaPages).containsExactlyElementsOf(scoped());
    }

    // --- cohérence avec la recherche à entités ---------------------------------------------------

    @Test
    void searchRowsRenvoieLesMemesOffresQueSearchPourLesMemesCriteres() {
        JobOfferSearch criteria = new JobOfferSearch(null, JobOfferStatus.PUBLISHED, null, null, null, null, null,
                null, "%" + token + "%", true, null, null, JobOfferSearch.Order.CREATED_DESC);

        Page<JobOfferRow> rows = searchRepository.searchRows(criteria, PageRequest.of(0, 50));
        var entities = searchRepository.search(criteria, PageRequest.of(0, 50));

        assertThat(rows.getContent()).extracting(JobOfferRow::id)
                .containsExactlyElementsOf(entities.getContent().stream().map(o -> o.getId()).toList());
        assertThat(rows.getTotalElements()).isEqualTo(entities.getTotalElements()).isEqualTo(7);
    }

    // --- entrées invalides et accès --------------------------------------------------------------

    @Test
    void lesValeursNonSupporteesRenvoientUn400SansEcho() throws Exception {
        mockMvc.perform(get("/api/v1/admin/job-offers").header("Authorization", "Bearer " + adminToken)
                        .param("status", "archived"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Unsupported status filter"))
                .andExpect(jsonPath("$.detail")
                        .value("Only draft, validated, published and closed can be used as a status filter."));
        for (String[] invalid : new String[][] {{"seniority", "expert"}, {"expiry", "soon"}}) {
            mockMvc.perform(get("/api/v1/admin/job-offers").header("Authorization", "Bearer " + adminToken)
                            .param(invalid[0], invalid[1]))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Unsupported filter value"))
                    .andExpect(jsonPath("$.detail")
                            .value("The '" + invalid[0] + "' filter has an unsupported value."));
        }
    }

    @Test
    void unIdentifiantMalformeRenvoieLeMessageGenerique() throws Exception {
        for (String name : List.of("workModeId", "contractTypeId", "employmentTypeId")) {
            mockMvc.perform(get("/api/v1/admin/job-offers").header("Authorization", "Bearer " + adminToken)
                            .param(name, "not-a-uuid"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.detail").value("The request could not be processed."));
        }
    }

    @Test
    void unIdentifiantInconnuDonneUnePageVide() throws Exception {
        JsonNode page = list("q", token, "workModeId", UUID.randomUUID().toString());

        assertThat(page.get("items")).isEmpty();
        assertThat(page.get("total").asLong()).isZero();
    }

    @Test
    void laListeEstReserveAuxAdministrateurs() throws Exception {
        mockMvc.perform(get("/api/v1/admin/job-offers").param("q", token))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/admin/job-offers").param("q", token)
                        .header("Authorization", "Bearer " + recruiterToken))
                .andExpect(status().isForbidden());
    }

    /**
     * Jeton ADMIN : le rôle est inséré après l'inscription, donc une nouvelle
     * connexion est nécessaire pour que le claim {@code roles} le porte.
     */
    private String createAdminToken() throws Exception {
        String email = "admin-filters-" + UUID.randomUUID() + "@example.com";
        MvcResult signup = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "secret123",
                                  "firstName": "Admin",
                                  "lastName": "Zadmin",
                                  "phone": "+1 555 000 0000",
                                  "sex": "female",
                                  "homeCountry": "FR",
                                  "currentCity": "Paris",
                                  "currentCountry": "FR"
                                }
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID id = UUID.fromString(objectMapper.readTree(signup.getResponse().getContentAsString())
                .get("user").get("id").asText());
        adminIds.add(id);
        jdbcTemplate.update("INSERT INTO user_roles (user_id, role) VALUES (?, 1)", id);

        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "%s", "password": "secret123"}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(login.getResponse().getContentAsString()).get("token").asText();
    }
}

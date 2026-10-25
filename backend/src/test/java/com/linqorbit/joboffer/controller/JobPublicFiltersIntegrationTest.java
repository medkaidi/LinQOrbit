package com.linqorbit.joboffer.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;

import tools.jackson.databind.JsonNode;

/**
 * Recherche, filtres et tri du job board public (T-77) sur PostgreSQL réel :
 * chaque entrée facultative est vérifiée renseignée / vide / absente / invalide,
 * et aucun filtre ne peut faire sortir une offre hors du périmètre public
 * (publiées, non expirées). Base partagée : toute assertion est scopée par un
 * jeton unique placé dans les titres.
 */
@SpringBootTest
@AutoConfigureMockMvc
class JobPublicFiltersIntegrationTest extends JobOfferSearchTestSupport {

    private String tok;
    private String backend;
    private String frontend;
    private String data;
    private String platform;
    private String percent;
    private String snake;

    /**
     * Visibles, de la plus récente publication à la plus ancienne : snake (5 s), percent (10 s),
     * platform (20 s, société « Zed tok »), data (30 s), frontend (40 s), backend (50 s).
     * Invisibles : brouillon, validée, clôturée, expirée.
     */
    @BeforeEach
    void seed() throws Exception {
        tok = uniqueToken();
        backend = tok + " Backend Dev";
        frontend = tok + " Frontend Dev";
        data = tok + " Data Engineer";
        platform = "Platform Engineer";
        percent = tok + "% Bonus";
        snake = tok + "_Snake";
        LocalDate today = LocalDate.now();

        Owner acme = owner("Acme");
        offer(acme, acme.companyId(), backend, Spec.published(50).seniority(SENIOR));
        offer(acme, acme.companyId(), frontend, Spec.published(40).seniority(JUNIOR).workMode(HYBRID)
                .employment(PART_TIME).country("DE").expiresAt(today.plusDays(10)));
        offer(acme, acme.companyId(), data, Spec.published(30).seniority(LEAD).contract(FIXED_TERM)
                .expiresAt(today.plusDays(3)));
        offer(acme, acme.companyId(), tok + " Draft Dev", Spec.published(25).status(DRAFT));
        offer(acme, acme.companyId(), tok + " Validated Dev", Spec.published(24).status(VALIDATED));
        offer(acme, acme.companyId(), tok + " Closed Dev", Spec.published(23).status(CLOSED));
        offer(acme, acme.companyId(), tok + " Expired Dev", Spec.published(22).expiresAt(today.minusDays(1)));
        offer(acme, acme.companyId(), percent, Spec.published(10).workMode(ON_SITE).country("ES"));
        offer(acme, acme.companyId(), snake, Spec.published(5).workMode(ON_SITE).country("ES"));

        Owner zed = owner("Zed " + tok);
        offer(zed, zed.companyId(), platform, Spec.published(20).workMode(ON_SITE).contract(FIXED_TERM)
                .employment(PART_TIME).country("ES"));
    }

    private JsonNode search(String... params) throws Exception {
        var request = get("/api/v1/jobs");
        for (int i = 0; i < params.length; i += 2) {
            request = request.param(params[i], params[i + 1]);
        }
        return ok(request);
    }

    private List<String> titles(String... params) throws Exception {
        return titlesOf(search(params));
    }

    // --- nominal et recherche -------------------------------------------------------------------

    @Test
    void sansParametreRenvoieLEnveloppeAvecAuMoinsLesOffresVisibles() throws Exception {
        JsonNode page = search();

        assertThat(page.get("page").asInt()).isZero();
        assertThat(page.get("size").asInt()).isEqualTo(20);
        assertThat(page.get("total").asLong()).isGreaterThanOrEqualTo(6);
    }

    @Test
    void laRechercheEstInsensibleALaCasseEtTrieParPublicationDecroissante() throws Exception {
        JsonNode page = search("q", tok.toUpperCase());

        assertThat(titlesOf(page)).containsExactly(snake, percent, platform, data, frontend, backend);
        assertThat(page.get("total").asLong()).isEqualTo(6);
    }

    @Test
    void laRechercheCouvreLeNomDeLaSociete() throws Exception {
        assertThat(titles("q", "ZED " + tok)).containsExactly(platform);
        assertThat(titles("q", "  zed " + tok + "  ")).containsExactly(platform);
    }

    @Test
    void lesJokersSaisisSontDesCaracteresLitteraux() throws Exception {
        assertThat(titles("q", tok + "%")).containsExactly(percent);
        assertThat(titles("q", tok + "_")).containsExactly(snake);
    }

    @Test
    void uneRechercheTropLongueEstBorneeSansErreur() throws Exception {
        JsonNode page = search("q", backend + "z".repeat(300));

        assertThat(page.get("total").asLong()).isZero();
        assertThat(page.get("items")).isEmpty();
    }

    @Test
    void uneRechercheBlancheEquivautAAucunFiltre() throws Exception {
        assertThat(search("q", "   ").get("total").asLong()).isGreaterThanOrEqualTo(6);
        assertThat(search("q", "").get("total").asLong()).isGreaterThanOrEqualTo(6);
    }

    // --- filtres ---------------------------------------------------------------------------------

    @Test
    void chaqueFiltreRestreintLaListe() throws Exception {
        assertThat(titles("q", tok, "workModeId", REMOTE.toString())).containsExactly(data, backend);
        assertThat(titles("q", tok, "workModeId", HYBRID.toString())).containsExactly(frontend);
        assertThat(titles("q", tok, "workModeId", ON_SITE.toString())).containsExactly(snake, percent, platform);
        assertThat(titles("q", tok, "contractTypeId", FIXED_TERM.toString())).containsExactly(platform, data);
        assertThat(titles("q", tok, "employmentTypeId", PART_TIME.toString())).containsExactly(platform, frontend);
        assertThat(titles("q", tok, "seniority", "senior")).containsExactly(backend);
        assertThat(titles("q", tok, "seniority", "lead")).containsExactly(data);
        assertThat(titles("q", tok, "seniority", "mid")).containsExactly(snake, percent, platform);
        assertThat(titles("q", tok, "country", "FR")).containsExactly(data, backend);
        assertThat(titles("q", tok, "country", "DE")).containsExactly(frontend);
    }

    @Test
    void laSeniorieEtLePaysIgnorentLaCasseEtLesEspaces() throws Exception {
        assertThat(titles("q", tok, "seniority", "  SeNiOr ")).containsExactly(backend);
        assertThat(titles("q", tok, "country", " fr ")).containsExactly(data, backend);
        assertThat(titles("q", tok, "country", "De")).containsExactly(frontend);
    }

    @Test
    void lesFiltresSeCombinentParEt() throws Exception {
        assertThat(titles("q", tok, "workModeId", REMOTE.toString(), "country", "FR", "seniority", "lead"))
                .containsExactly(data);
        assertThat(titles("q", tok, "workModeId", REMOTE.toString(), "country", "DE")).isEmpty();
    }

    @Test
    void unFiltreSansCorrespondanceRenvoieUnePageVideEtUnTotalNul() throws Exception {
        JsonNode page = search("q", tok, "seniority", "principal");

        assertThat(page.get("items")).isEmpty();
        assertThat(page.get("total").asLong()).isZero();
    }

    @Test
    void unIdentifiantInconnuMaisValideDonneUneListeVide() throws Exception {
        assertThat(titles("q", tok, "workModeId", UUID.randomUUID().toString())).isEmpty();
    }

    @Test
    void lesParametresVidesEquivalentAuxParametresAbsents() throws Exception {
        List<String> withoutParams = titles("q", tok);
        List<String> withEmptyParams = titles("q", tok, "workModeId", "", "contractTypeId", "",
                "employmentTypeId", "", "seniority", "", "country", "", "sort", "");

        assertThat(withEmptyParams).containsExactlyElementsOf(withoutParams).hasSize(6);
    }

    // --- tri -------------------------------------------------------------------------------------

    @Test
    void leTriParEcheanceProchePlaceLesOffresSansEcheanceEnDernier() throws Exception {
        // Échéances : data (+3 j), frontend (+10 j), puis sans échéance par publication décroissante.
        List<String> expected = List.of(data, frontend, snake, percent, platform, backend);

        assertThat(titles("q", tok, "sort", "expiringSoon")).containsExactlyElementsOf(expected);
        assertThat(titles("q", tok, "sort", "EXPIRINGSOON")).containsExactlyElementsOf(expected);
    }

    @Test
    void leTriParDefautEstLaPublicationLaPlusRecente() throws Exception {
        List<String> expected = List.of(snake, percent, platform, data, frontend, backend);

        assertThat(titles("q", tok)).containsExactlyElementsOf(expected);
        assertThat(titles("q", tok, "sort", "recent")).containsExactlyElementsOf(expected);
        assertThat(titles("q", tok, "sort", " Recent ")).containsExactlyElementsOf(expected);
    }

    // --- périmètre public ------------------------------------------------------------------------

    @Test
    void aucunFiltreNeFaitSortirUneOffreNonPubliqueOuExpiree() throws Exception {
        List<String> hidden = List.of(tok + " Draft Dev", tok + " Validated Dev", tok + " Closed Dev",
                tok + " Expired Dev");

        assertThat(titles("q", tok)).doesNotContainAnyElementsOf(hidden);
        assertThat(titles("q", tok, "sort", "expiringSoon")).doesNotContainAnyElementsOf(hidden);
        assertThat(titles("q", tok, "seniority", "mid")).doesNotContainAnyElementsOf(hidden);
        assertThat(titles("q", tok, "country", "FR")).doesNotContainAnyElementsOf(hidden);
        // Un paramètre de statut n'existe pas sur la route publique : ignoré, jamais interprété.
        assertThat(titles("q", tok, "status", "draft")).doesNotContainAnyElementsOf(hidden);
        assertThat(titles("q", tok + " Draft")).isEmpty();
        assertThat(titles("q", tok + " Expired")).isEmpty();
    }

    // --- pagination ------------------------------------------------------------------------------

    @Test
    void uneRechercheFiltreeRenvoieLeTotalFiltreEtGerePagesHorsPlage() throws Exception {
        JsonNode page = search("q", tok);
        assertThat(page.get("total").asLong()).isEqualTo(6);

        JsonNode outOfRange = search("q", tok, "page", "9999");
        assertThat(outOfRange.get("items")).isEmpty();
        assertThat(outOfRange.get("total").asLong()).isEqualTo(6);

        JsonNode second = search("q", tok, "page", "1");
        assertThat(second.get("items")).isEmpty();
        assertThat(second.get("total").asLong()).isEqualTo(6);
        assertThat(second.get("page").asInt()).isEqualTo(1);
    }

    // --- entrées invalides -----------------------------------------------------------------------

    @Test
    void lesValeursNonSupporteesRenvoientUn400SansEcho() throws Exception {
        for (String[] invalid : new String[][] {
                {"seniority", "expert"}, {"country", "FRA"}, {"country", "F1"}, {"country", "?"},
                {"sort", "salary"}}) {
            mockMvc.perform(get("/api/v1/jobs").param("q", tok).param(invalid[0], invalid[1]))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Unsupported filter value"))
                    .andExpect(jsonPath("$.detail")
                            .value("The '" + invalid[0] + "' filter has an unsupported value."));
        }
    }

    @Test
    void unIdentifiantMalformeRenvoieLeMessageGenerique() throws Exception {
        mockMvc.perform(get("/api/v1/jobs").param("workModeId", "not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("The request could not be processed."));
    }
}

package com.linqorbit.application.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import tools.jackson.databind.JsonNode;

/**
 * Signalement interne d'une évaluation IA par critère (T-86, D66) sur
 * PostgreSQL réel : création, doublon, clé inconnue, motif invalide, règle du
 * commentaire, droits, immuabilité (aucun effet sur le résultat, aucune
 * édition) et lecture console admin.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CriterionReportIntegrationTest extends RecruiterApplicationTestSupport {

    private static final String REPORTS_PATH = "/api/v1/admin/criterion-reports";

    @Test
    void signaleUnCritereSansEffetSurLEvaluation() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);
        Account candidate = signup("Grace", "Hopper");
        UUID applicationId = draftAndMatch(candidate, uploadCv(candidate.token()), publicId,
                resultJson(60, 70, 80, 90, 95), List.of(), null);
        String resultBefore = resultOf(applicationId);

        report(owner.token(), offerId, applicationId, "skill:java", "scoreIncorrect", null)
                .andExpect(status().isCreated());

        // Le résultat épinglé est inchangé : aucun recalcul, aucun effet sur le score.
        assertThat(resultOf(applicationId)).isEqualTo(resultBefore);
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM matching_criterion_report r
                JOIN application a ON a.matching_id = r.matching_id
                WHERE a.id = ? AND r.criterion_key = 'skill:java'""", Integer.class, applicationId))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("""
                SELECT r.comment IS NULL FROM matching_criterion_report r
                JOIN application a ON a.matching_id = r.matching_id
                WHERE a.id = ? AND r.criterion_key = 'skill:java'""", Boolean.class, applicationId))
                .isTrue();

        // Le détail n'expose que les signalements de son auteur.
        mockMvc.perform(get(OFFERS_PATH + "/" + offerId + "/applications/" + applicationId)
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.criterionReports.length()").value(1))
                .andExpect(jsonPath("$.criterionReports[0].criterionKey").value("skill:java"))
                .andExpect(jsonPath("$.criterionReports[0].reason").value("scoreIncorrect"))
                .andExpect(jsonPath("$.criterionReports[0].comment").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.criterionReports[0].createdAt").isNotEmpty());
    }

    @Test
    void refuseDoublonCleInconnueMotifInvalideEtCommentaireObligatoire() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);
        Account candidate = signup("Grace", "Hopper");
        UUID applicationId = draftAndMatch(candidate, uploadCv(candidate.token()), publicId,
                resultJson(60, 70, 80, 90, 95), List.of(), null);

        // Doublon du même auteur sur le même critère : 409.
        report(owner.token(), offerId, applicationId, "skill:java", "scoreIncorrect", null)
                .andExpect(status().isCreated());
        report(owner.token(), offerId, applicationId, "skill:java", "scoreIncorrect", null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("You have already reported this criterion."));

        // Un autre auteur peut signaler le même critère (unicité par auteur).
        Account member = memberOf(owner.companyId());
        report(member.token(), offerId, applicationId, "skill:java", "evidenceWrong", "The CV shows 8 years")
                .andExpect(status().isCreated());

        // Clé inconnue dans le résultat affiché : 400, rien n'est écrit.
        report(owner.token(), offerId, applicationId, "skill:ghost", "scoreIncorrect", null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail")
                        .value("This criterion does not exist in the assessment of this application."));

        // Motif inconnu : 400.
        report(owner.token(), offerId, applicationId, "language:english", "bogusReason", null)
                .andExpect(status().isBadRequest());

        // Motif « other » sans commentaire : 400 ; avec un commentaire : 201.
        report(owner.token(), offerId, applicationId, "language:english", "other", null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("A comment is required when the reason is other."));
        report(owner.token(), offerId, applicationId, "language:english", "other", "The offer is ambiguous")
                .andExpect(status().isCreated());
        assertThat(jdbcTemplate.queryForObject("""
                SELECT r.comment FROM matching_criterion_report r
                JOIN application a ON a.matching_id = r.matching_id
                WHERE a.id = ? AND r.criterion_key = 'language:english' AND r.reason = 5""",
                String.class, applicationId))
                .isEqualTo("The offer is ambiguous");

        // Un commentaire blanc vaut absence : refusé pour « other ».
        report(owner.token(), offerId, applicationId, "experience:years", "other", "   ")
                .andExpect(status().isBadRequest());

        // Commentaire trop long : 400 (validation de la requête).
        report(owner.token(), offerId, applicationId, "experience:years", "scoreIncorrect", "x".repeat(2001))
                .andExpect(status().isBadRequest());

        // Le détail n'expose que les signalements de son auteur : le membre ne
        // voit que le sien, l'owner voit les deux siens.
        mockMvc.perform(get(OFFERS_PATH + "/" + offerId + "/applications/" + applicationId)
                        .header("Authorization", "Bearer " + member.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.criterionReports.length()").value(1))
                .andExpect(jsonPath("$.criterionReports[0].criterionKey").value("skill:java"))
                .andExpect(jsonPath("$.criterionReports[0].reason").value("evidenceWrong"))
                .andExpect(jsonPath("$.criterionReports[0].comment").value("The CV shows 8 years"));
        mockMvc.perform(get(OFFERS_PATH + "/" + offerId + "/applications/" + applicationId)
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.criterionReports.length()").value(2))
                .andExpect(jsonPath("$.criterionReports[0].criterionKey").value("language:english"))
                .andExpect(jsonPath("$.criterionReports[1].criterionKey").value("skill:java"));
    }

    @Test
    void refuseApplicationHorsCompanyAutreOffreBroouillonEtSansEvaluation() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);

        // Candidature transmise avec évaluation.
        Account candidate = signup("Grace", "Hopper");
        UUID applicationId = draftAndMatch(candidate, uploadCv(candidate.token()), publicId,
                resultJson(60, 70, 80, 90, 95), List.of(), null);

        // Recruteur d'une autre company : 404 sûr.
        Account outsider = signupRecruiter("Out", "Sider");
        report(outsider.token(), offerId, applicationId, "skill:java", "scoreIncorrect", null)
                .andExpect(status().isNotFound());

        // Candidature d'une autre offre : 404.
        Owner other = ownerWithCompany("Other Co");
        UUID otherOfferId = createOffer(other.token(), other.companyId(), "Frontend Engineer", null);
        publish(other.token(), otherOfferId);
        Account otherCandidate = signup("Alan", "Turing");
        UUID otherApplicationId = draftAndMatch(otherCandidate, uploadCv(otherCandidate.token()),
                publicIdOf(otherOfferId), resultJson(60, 70, 80, 90, 95), List.of(), null);
        report(owner.token(), offerId, otherApplicationId, "skill:java", "scoreIncorrect", null)
                .andExpect(status().isNotFound());

        // Brouillon : invisible (404), comme le détail.
        Account draftCandidate = signup("Edsger", "Dijkstra");
        uploadCv(draftCandidate.token());
        UUID draftId = idOf(saveDraft(draftCandidate.token(), publicId, "[]")
                .andExpect(status().isOk()).andReturn());
        report(owner.token(), offerId, draftId, "skill:java", "scoreIncorrect", null)
                .andExpect(status().isNotFound());

        // Application directe sans matching : aucune évaluation à signaler (409).
        Account direct = signup("Barbara", "Liskov");
        UUID directId = submitDirect(direct, uploadCv(direct.token()), publicId);
        report(owner.token(), offerId, directId, "skill:java", "scoreIncorrect", null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail")
                        .value("This application has no finished AI assessment to report."));

        // Sans jeton : 401.
        mockMvc.perform(post(OFFERS_PATH + "/" + offerId + "/applications/" + applicationId
                        + "/criterion-reports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"criterionKey\": \"skill:java\", \"reason\": \"scoreIncorrect\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void laBaseRefuseDoublonEtAutreSansCommentaire() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);
        Account candidate = signup("Grace", "Hopper");
        UUID applicationId = draftAndMatch(candidate, uploadCv(candidate.token()), publicId,
                resultJson(60, 70, 80, 90, 95), List.of(), null);
        report(owner.token(), offerId, applicationId, "skill:java", "scoreIncorrect", null)
                .andExpect(status().isCreated());

        UUID reportId = jdbcTemplate.queryForObject("""
                SELECT r.id FROM matching_criterion_report r
                JOIN application a ON a.matching_id = r.matching_id
                WHERE a.id = ? AND r.criterion_key = 'skill:java'""", UUID.class, applicationId);
        UUID resultId = jdbcTemplate.queryForObject(
                "SELECT matching_result_id FROM matching_criterion_report WHERE id = ?", UUID.class, reportId);
        UUID matchingId = jdbcTemplate.queryForObject(
                "SELECT matching_id FROM matching_criterion_report WHERE id = ?", UUID.class, reportId);

        // Unicité (résultat, critère, auteur) : la base tranche, pas seulement le service.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO matching_criterion_report
                    (id, matching_id, matching_result_id, criterion_key, author_user_id, reason, created_at)
                VALUES (?, ?, ?, 'skill:java', ?, 1, now())""",
                UUID.randomUUID(), matchingId, resultId, authorOf(reportId)))
                .isInstanceOf(DataIntegrityViolationException.class);

        // « other » sans commentaire : refusé par la base.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO matching_criterion_report
                    (id, matching_id, matching_result_id, criterion_key, author_user_id, reason, created_at)
                VALUES (?, ?, ?, 'skill:kotlin', ?, 5, now())""",
                UUID.randomUUID(), matchingId, resultId, authorOf(reportId)))
                .isInstanceOf(DataIntegrityViolationException.class);

        // Motif hors bornes : refusé par la base.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO matching_criterion_report
                    (id, matching_id, matching_result_id, criterion_key, author_user_id, reason, created_at)
                VALUES (?, ?, ?, 'skill:kotlin', ?, 9, now())""",
                UUID.randomUUID(), matchingId, resultId, authorOf(reportId)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void consoleAdminListeLesSignalements() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);
        Account candidate = signup("Grace", "Hopper");
        UUID applicationId = draftAndMatch(candidate, uploadCv(candidate.token()), publicId,
                resultJson(60, 70, 80, 90, 95), List.of(), null);
        report(owner.token(), offerId, applicationId, "skill:java", "scoreIncorrect", "The CV shows 8 years")
                .andExpect(status().isCreated());
        // Deux signalements, et un éventuel signalement déjà présent en base :
        // la liste est globale, elle ne doit jamais supposer qu'un seul existe.
        report(owner.token(), offerId, applicationId, "language:english", "other", "The requirement is ambiguous")
                .andExpect(status().isCreated());
        UUID firstReportId = jdbcTemplate.queryForObject("""
                SELECT r.id FROM matching_criterion_report r
                JOIN application a ON a.matching_id = r.matching_id
                WHERE a.id = ? AND r.criterion_key = 'skill:java'""", UUID.class, applicationId);
        UUID secondReportId = jdbcTemplate.queryForObject("""
                SELECT r.id FROM matching_criterion_report r
                JOIN application a ON a.matching_id = r.matching_id
                WHERE a.id = ? AND r.criterion_key = 'language:english'""", UUID.class, applicationId);

        String adminToken = adminToken();
        MvcResult listResult = mockMvc.perform(get(REPORTS_PATH)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andReturn();
        JsonNode page = objectMapper.readTree(listResult.getResponse().getContentAsString());
        assertThat(page.get("total").asLong()).isGreaterThanOrEqualTo(2);
        JsonNode first = findReport(page.get("items"), firstReportId);
        assertThat(first).isNotNull();
        assertThat(first.get("criterionKey").asText()).isEqualTo("skill:java");
        assertThat(first.get("criterionLabel").asText()).isEqualTo("Java");
        assertThat(first.get("section").asText()).isEqualTo("requiredSkills");
        assertThat(first.get("score").asInt()).isEqualTo(60);
        assertThat(first.get("sectionScore").asDouble()).isEqualTo(60.0);
        assertThat(first.get("reason").asText()).isEqualTo("scoreIncorrect");
        assertThat(first.get("comment").asText()).isEqualTo("The CV shows 8 years");
        assertThat(first.get("authorFirstName").asText()).isEqualTo("Ada");
        assertThat(first.get("authorLastName").asText()).isEqualTo("Owner");
        assertThat(first.get("authorEmail").asText()).isNotEmpty();
        assertThat(first.get("candidateFirstName").asText()).isEqualTo("Grace");
        assertThat(first.get("candidateLastName").asText()).isEqualTo("Hopper");
        assertThat(first.get("offerId").asText()).isEqualTo(offerId.toString());
        assertThat(first.get("offerTitle").asText()).isEqualTo("Backend Engineer");
        assertThat(first.get("companyName").asText()).isEqualTo("Acme");
        assertThat(first.get("createdAt").asText()).isNotEmpty();
        JsonNode second = findReport(page.get("items"), secondReportId);
        assertThat(second).isNotNull();
        assertThat(second.get("score").asInt()).isEqualTo(80);
        assertThat(second.get("sectionScore").asDouble()).isEqualTo(80.0);
        assertThat(second.get("reason").asText()).isEqualTo("other");
        assertThat(second.get("comment").asText()).isEqualTo("The requirement is ambiguous");

        // Bornes de pagination appliquées au niveau HTTP.
        mockMvc.perform(get(REPORTS_PATH).param("size", "999").param("page", "-3")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(50))
                .andExpect(jsonPath("$.page").value(0));

        // Un compte sans rôle ADMIN : 403 ; sans jeton : 401.
        mockMvc.perform(get(REPORTS_PATH).header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(REPORTS_PATH)).andExpect(status().isUnauthorized());
    }

    @Test
    void consoleAdminConsulteLeDossierDUnSignalement() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);
        Account candidate = signup("Grace", "Hopper");
        UUID applicationId = draftAndMatch(candidate, uploadCv(candidate.token()), publicId,
                resultJson(60, 70, 80, 90, 95),
                List.of(feedback("skill:java", 80, "I have eight years of Java.")), null);
        report(owner.token(), offerId, applicationId, "skill:java", "evidenceWrong",
                "The CV shows eight years, not three.")
                .andExpect(status().isCreated());
        UUID reportId = jdbcTemplate.queryForObject("""
                SELECT r.id FROM matching_criterion_report r
                JOIN application a ON a.matching_id = r.matching_id
                WHERE a.id = ? AND r.criterion_key = 'skill:java'""", UUID.class, applicationId);

        mockMvc.perform(get(REPORTS_PATH + "/" + reportId)
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.report.id").value(reportId.toString()))
                .andExpect(jsonPath("$.report.reason").value("evidenceWrong"))
                .andExpect(jsonPath("$.report.comment").value("The CV shows eight years, not three."))
                .andExpect(jsonPath("$.report.offerId").value(offerId.toString()))
                .andExpect(jsonPath("$.report.authorFirstName").value("Ada"))
                .andExpect(jsonPath("$.candidateUserId").value(candidate.userId().toString()))
                // Critère relu dans le résultat épinglé : score, exigence et justification.
                .andExpect(jsonPath("$.criterion.key").value("skill:java"))
                .andExpect(jsonPath("$.criterion.label").value("Java"))
                .andExpect(jsonPath("$.criterion.section").value("requiredSkills"))
                .andExpect(jsonPath("$.criterion.score").value(60))
                .andExpect(jsonPath("$.criterion.sectionScore").value(60.0))
                .andExpect(jsonPath("$.criterion.requirement").value("Strong Java"))
                .andExpect(jsonPath("$.criterion.rationale").value("Criterion rationale"))
                .andExpect(jsonPath("$.criterion.resolved").value(true))
                // Évaluation complète + contestation du candidat + écart moyen serveur.
                .andExpect(jsonPath("$.assessment.available").value(true))
                .andExpect(jsonPath("$.assessment.sections.length()").value(5))
                .andExpect(jsonPath("$.contests.length()").value(1))
                .andExpect(jsonPath("$.contests[0].criterionKey").value("skill:java"))
                .andExpect(jsonPath("$.contests[0].aiScore").value(60))
                .andExpect(jsonPath("$.contests[0].selfValue").value(80))
                .andExpect(jsonPath("$.contests[0].gap").value(20))
                .andExpect(jsonPath("$.contests[0].comment").value("I have eight years of Java."))
                .andExpect(jsonPath("$.averageGap").value(20.0));
    }

    @Test
    void dossierAdminSansContestationEtCritereDevenuIntrouvable() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);
        Account candidate = signup("Grace", "Hopper");
        UUID applicationId = draftAndMatch(candidate, uploadCv(candidate.token()), publicId,
                resultJson(60, 70, 80, 90, 95), List.of(), null);
        report(owner.token(), offerId, applicationId, "skill:java", "scoreIncorrect", null)
                .andExpect(status().isCreated());
        UUID reportId = jdbcTemplate.queryForObject("""
                SELECT r.id FROM matching_criterion_report r
                JOIN application a ON a.matching_id = r.matching_id
                WHERE a.id = ? AND r.criterion_key = 'skill:java'""", UUID.class, applicationId);
        String adminToken = adminToken();

        mockMvc.perform(get(REPORTS_PATH + "/" + reportId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contests.length()").value(0))
                .andExpect(jsonPath("$.averageGap").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.report.comment").value(org.hamcrest.Matchers.nullValue()));

        // Anomalie de données : le critère n'existe plus dans le résultat épinglé.
        // La page reste lisible — aucun score inventé, `resolved` à faux.
        jdbcTemplate.update("UPDATE matching_result SET result = '{\"sections\":[]}'::jsonb"
                + " WHERE id = (SELECT matching_result_id FROM matching_criterion_report WHERE id = ?)", reportId);
        mockMvc.perform(get(REPORTS_PATH + "/" + reportId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.criterion.resolved").value(false))
                .andExpect(jsonPath("$.criterion.label").value("skill:java"))
                .andExpect(jsonPath("$.criterion.score")
                        .value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.criterion.modelName")
                        .value(org.hamcrest.Matchers.nullValue()));

        // Même résultat corrompu dans la liste : aucun score inventé, les deux
        // champs restent nuls et le libellé retombe sur la clé du critère.
        MvcResult listResult = mockMvc.perform(get(REPORTS_PATH)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode page = objectMapper.readTree(listResult.getResponse().getContentAsString());
        JsonNode item = findReport(page.get("items"), reportId);
        assertThat(item).isNotNull();
        assertThat(item.get("criterionLabel").asText()).isEqualTo("skill:java");
        assertThat(item.get("section").isNull()).isTrue();
        assertThat(item.get("score").isNull()).isTrue();
        assertThat(item.get("sectionScore").isNull()).isTrue();
    }

    @Test
    void dossierAdminExposeLeNomDuModeleEtLeLaisseNulPourUnAncienResultat() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);
        Account candidate = signup("Grace", "Hopper");
        UUID applicationId = draftAndMatch(candidate, uploadCv(candidate.token()), publicId,
                resultJson(60, 70, 80, 90, 95), List.of(), null);
        report(owner.token(), offerId, applicationId, "skill:java", "scoreIncorrect", null)
                .andExpect(status().isCreated());
        UUID reportId = jdbcTemplate.queryForObject("""
                SELECT r.id FROM matching_criterion_report r
                JOIN application a ON a.matching_id = r.matching_id
                WHERE a.id = ? AND r.criterion_key = 'skill:java'""", UUID.class, applicationId);
        String adminToken = adminToken();

        // Résultat de schéma 2 : le modèle réellement appelé est exposé tel quel.
        jdbcTemplate.update("""
                UPDATE matching_result SET schema_version = '2',
                  result = jsonb_set(result, '{modelName}', '"gemini-3.1-flash-lite"'::jsonb)
                WHERE id = (SELECT matching_result_id FROM matching_criterion_report WHERE id = ?)""", reportId);
        mockMvc.perform(get(REPORTS_PATH + "/" + reportId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.criterion.modelName").value("gemini-3.1-flash-lite"))
                .andExpect(jsonPath("$.criterion.resolved").value(true));

        // Ancien résultat (schéma 1, champ absent) : aucun nom inventé.
        jdbcTemplate.update("""
                UPDATE matching_result SET schema_version = '1', result = result - 'modelName'
                WHERE id = (SELECT matching_result_id FROM matching_criterion_report WHERE id = ?)""", reportId);
        mockMvc.perform(get(REPORTS_PATH + "/" + reportId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.criterion.modelName").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.criterion.resolved").value(true));

        // La provenance est portée par le résultat, pas par le critère : elle
        // reste lisible même si la clé a disparu (aucune note inventée).
        jdbcTemplate.update("""
                UPDATE matching_result SET schema_version = '2',
                  result = jsonb_set(
                    jsonb_set(result, '{modelName}', '"gemini-3.1-flash-lite"'::jsonb),
                    '{sections}', '[]'::jsonb)
                WHERE id = (SELECT matching_result_id FROM matching_criterion_report WHERE id = ?)""", reportId);
        mockMvc.perform(get(REPORTS_PATH + "/" + reportId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.criterion.modelName").value("gemini-3.1-flash-lite"))
                .andExpect(jsonPath("$.criterion.resolved").value(false))
                .andExpect(jsonPath("$.criterion.score").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void dossierAdminInconnuEst404EtRouteProtegee() throws Exception {
        Owner owner = ownerWithCompany("Acme");

        mockMvc.perform(get(REPORTS_PATH + "/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("No AI report matches this identifier."));
        mockMvc.perform(get(REPORTS_PATH + "/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(REPORTS_PATH + "/" + UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    private static JsonNode findReport(JsonNode items, UUID reportId) {
        for (JsonNode item : items) {
            if (reportId.toString().equals(item.get("id").asText())) {
                return item;
            }
        }
        return null;
    }

    private UUID authorOf(UUID reportId) {
        return jdbcTemplate.queryForObject(
                "SELECT author_user_id FROM matching_criterion_report WHERE id = ?", UUID.class, reportId);
    }

    private String resultOf(UUID applicationId) {
        return jdbcTemplate.queryForObject("""
                SELECT r.result::text FROM matching_result r
                JOIN application a ON a.matching_id = r.matching_id
                WHERE a.id = ? AND r.version = 1""", String.class, applicationId);
    }

    private ResultActions report(String token, UUID offerId, UUID applicationId, String criterionKey,
            String reason, String comment) throws Exception {
        String body = comment == null
                ? "{\"criterionKey\": \"%s\", \"reason\": \"%s\"}".formatted(criterionKey, reason)
                : "{\"criterionKey\": \"%s\", \"reason\": \"%s\", \"comment\": \"%s\"}"
                        .formatted(criterionKey, reason, comment.replace("\"", "\\\""));
        return mockMvc.perform(post(OFFERS_PATH + "/" + offerId + "/applications/" + applicationId
                        + "/criterion-reports")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    /**
     * Jeton ADMIN : le rôle est inséré après le signup, donc un nouveau login
     * est nécessaire pour que le claim {@code roles} le porte.
     */
    private String adminToken() throws Exception {
        String email = "admin-reports-it-" + UUID.randomUUID() + "@example.com";
        MvcResult signupResult = mockMvc.perform(post("/api/v1/auth/signup")
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
        JsonNode body = objectMapper.readTree(signupResult.getResponse().getContentAsString());
        UUID id = UUID.fromString(body.get("user").get("id").asText());
        createdUserIds.add(id);
        jdbcTemplate.update("INSERT INTO user_roles (user_id, role) VALUES (?, 1)", id);

        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"%s\", \"password\": \"secret123\"}".formatted(email)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(login.getResponse().getContentAsString()).get("token").asText();
    }
}

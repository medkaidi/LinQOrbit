package com.linqorbit.invitation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.linqorbit.candidate.entity.SearchStatus;
import com.linqorbit.embedding.EmbeddingIntegrationTestSupport;
import com.linqorbit.embedding.EmbeddingTestData;
import com.linqorbit.embedding.EmbeddingTestData.OfferFixture;
import com.linqorbit.invitation.entity.OfferCandidateStatus;
import com.linqorbit.invitation.repository.OfferCandidateRepository;

/**
 * Profil complet d'un candidat suggéré et effet du retrait de consentement
 * (T-102, D86) sur PostgreSQL réel : le détail porte nom et profil, jamais
 * e-mail ni téléphone ; un retrait après le calcul du Top N masque aussitôt la
 * carte, le détail et l'invitation sans toucher à l'instantané ; un candidat
 * déjà invité garde son invitation côté candidat. Un candidat {@code not_looking}
 * est masqué de la même façon (D98), la carte du détail vient de la fiche
 * courante, et l'écriture de l'invitation contrôle elle-même la visibilité.
 */
class SuggestedCandidateProfileIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String SUGGESTED = "/api/v1/job-offers/{offerId}/suggested-candidates";
    private static final String PROFILE = SUGGESTED + "/{suggestionId}/profile";
    private static final String INVITE = SUGGESTED + "/{suggestionId}/invitations";
    private static final String MY_INVITATIONS = "/api/v1/candidates/me/invitations";
    private static final String OFFER_CONTENT = "{\"schemaVersion\":\"2\",\"title\":\"Developer\"}";
    private static final String CANDIDATE_CONTENT = """
            {"schemaVersion":"3","title":"Backend Engineer","seniority":"senior","yearsOfExperience":7,
             "location":{"country":"France"},"skills":[{"name":"Java","category":"hard_skill","level":4}]}""";
    private static final String PHONE = "+33 6 11 22 33 44";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OfferCandidateRepository offerCandidateRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private EmbeddingTestData data;
    private OfferFixture offer;
    private UUID offerId;
    private UUID screeningJobId;
    private UUID candidateId;
    private UUID suggestionId;

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
        offer = data.publishedOffer();
        offerId = offer.offerId();
        UUID offerFiche = data.offerFiche(offerId, 1, OFFER_CONTENT);
        screeningJobId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO screening_job (job_id, job_offer_id, offer_normalized_profile_id, status, attempts,
                                           next_attempt_at, candidate_count, created_at, completed_at)
                VALUES (?, ?, ?, 3, 1, now(), 1, now(), now())""", screeningJobId, offerId, offerFiche);
        candidateId = data.candidate(null);
        UUID fiche = data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT);
        suggestionId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO offer_candidate (id, job_offer_id, candidate_id, candidate_normalized_profile_id,
                                             screening_job_id, rank, distance, status, created_at)
                VALUES (?, ?, ?, ?, ?, 1, 0.1, 1, now())""", suggestionId, offerId, candidateId, fiche,
                screeningJobId);
        jdbc.update("""
                UPDATE candidates SET title = 'Backend Engineer', bio = 'Builds payment systems',
                    years_of_experience = 7 WHERE id = ?""", candidateId);
        jdbc.update("""
                INSERT INTO professional_experiences (id, candidate_id, position_title, description, start_date,
                                                      company_name, sort_order, created_at, updated_at)
                VALUES (?, ?, 'Tech Lead', 'Led the platform team', DATE '2020-01-01', 'Acme Corp', 0, now(), now())""",
                UUID.randomUUID(), candidateId);
        jdbc.update("UPDATE users SET phone = ?, current_city = 'Lyon', current_country = 'FR' WHERE id = ?",
                PHONE, candidateId);
    }

    @AfterEach
    void cleanup() {
        data.cleanup();
    }

    private static RequestPostProcessor as(UUID userId) {
        return jwt().jwt(token -> token.subject(userId.toString()));
    }

    // --- nominal ------------------------------------------------------------------------------

    @Test
    void theDetailCarriesTheNameTheCardAndTheFullProfile() throws Exception {
        mockMvc.perform(get(PROFILE, offerId, suggestionId).with(as(offer.creatorId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.card.id").value(suggestionId.toString()))
                .andExpect(jsonPath("$.card.firstName").value("Embedding"))
                .andExpect(jsonPath("$.card.lastName").value("IT"))
                .andExpect(jsonPath("$.card.title").value("Backend Engineer"))
                .andExpect(jsonPath("$.card.status").value("suggested"))
                .andExpect(jsonPath("$.canInvite").value(true))
                .andExpect(jsonPath("$.currentCity").value("Lyon"))
                .andExpect(jsonPath("$.currentCountry").value("FR"))
                .andExpect(jsonPath("$.profile.about.title").value("Backend Engineer"))
                .andExpect(jsonPath("$.profile.about.bio").value("Builds payment systems"))
                .andExpect(jsonPath("$.profile.experiences.length()").value(1))
                .andExpect(jsonPath("$.profile.experiences[0].companyName").value("Acme Corp"));
    }

    @Test
    void theDetailNeverCarriesAnEmailOrAPhoneNumberNorAnInternalCandidateId() throws Exception {
        String body = mockMvc.perform(get(PROFILE, offerId, suggestionId).with(as(offer.creatorId())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        // L'e-mail de la fixture embarque l'UUID du compte : le champ aussi doit être absent.
        assertThat(body).doesNotContain("embedding-it-", "@example.com", PHONE, "+33", "\"email\"",
                "\"phone\"", "candidateId", "normalizedProfileId", candidateId.toString());
    }

    @Test
    void canInviteFollowsTheManagementRightAndAppliedWinsInTheDetail() throws Exception {
        UUID plainMember = data.recruiterIn(offer.companyId(), false);
        mockMvc.perform(get(PROFILE, offerId, suggestionId).with(as(plainMember)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canInvite").value(false));

        data.application(candidateId, offerId, 2);
        mockMvc.perform(get(PROFILE, offerId, suggestionId).with(as(offer.creatorId())))
                .andExpect(jsonPath("$.card.status").value("applied"));
    }

    // --- droits et états ------------------------------------------------------------------------

    @Test
    void detailRights() throws Exception {
        OfferFixture foreign = data.publishedOffer();

        mockMvc.perform(get(PROFILE, offerId, suggestionId)).andExpect(status().isUnauthorized());
        mockMvc.perform(get(PROFILE, offerId, suggestionId).with(as(foreign.creatorId())))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(PROFILE, offerId, suggestionId).with(as(data.candidate(null))))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(PROFILE, offerId, UUID.randomUUID()).with(as(offer.creatorId())))
                .andExpect(status().isNotFound());
        // Une suggestion d'une autre offre n'est pas lisible via celle-ci.
        mockMvc.perform(get(PROFILE, foreign.offerId(), suggestionId).with(as(foreign.creatorId())))
                .andExpect(status().isNotFound());
    }

    @Test
    void anOfferThatIsNotOpenGivesAConflict() throws Exception {
        data.setOfferStatus(offerId, EmbeddingTestData.CLOSED, null);
        mockMvc.perform(get(PROFILE, offerId, suggestionId).with(as(offer.creatorId())))
                .andExpect(status().isConflict());

        data.setOfferStatus(offerId, EmbeddingTestData.PUBLISHED, LocalDate.now().minusDays(1));
        mockMvc.perform(get(PROFILE, offerId, suggestionId).with(as(offer.creatorId())))
                .andExpect(status().isConflict());
    }

    // --- retrait du consentement ----------------------------------------------------------------

    @Test
    void withdrawingTheConsentHidesTheCardAtOnceWithoutTouchingTheSnapshot() throws Exception {
        mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId())))
                .andExpect(jsonPath("$.items.length()").value(1));

        data.setConsent(candidateId, false);

        mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM offer_candidate WHERE id = ?", Integer.class,
                suggestionId)).isEqualTo(1);

        // Un nouvel accord rend la carte telle quelle : l'instantané n'a jamais bougé.
        data.setConsent(candidateId, true);
        mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId())))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(suggestionId.toString()));
    }

    @Test
    void withdrawingTheConsentOnlyHidesThatCandidateAndKeepsTheOthers() throws Exception {
        UUID otherCandidate = data.candidate(null);
        UUID otherFiche = data.candidateFiche(otherCandidate, 1, CANDIDATE_CONTENT);
        jdbc.update("""
                INSERT INTO offer_candidate (id, job_offer_id, candidate_id, candidate_normalized_profile_id,
                                             screening_job_id, rank, distance, status, created_at)
                VALUES (?, ?, ?, ?, ?, 2, 0.2, 1, now())""", UUID.randomUUID(), offerId, otherCandidate, otherFiche,
                screeningJobId);

        data.setConsent(candidateId, false);

        mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId())))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].rank").value(2));
    }

    @Test
    void withdrawingTheConsentMakesTheDetailAndTheInvitationNotFound() throws Exception {
        data.setConsent(candidateId, false);

        mockMvc.perform(get(PROFILE, offerId, suggestionId).with(as(offer.creatorId())))
                .andExpect(status().isNotFound());
        mockMvc.perform(post(INVITE, offerId, suggestionId).with(as(offer.creatorId())))
                .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT status FROM offer_candidate WHERE id = ?", String.class,
                suggestionId)).isEqualTo("1");
    }

    // --- recherche active et fiche courante (D98) -----------------------------------------------

    @Test
    void aNotLookingCandidateMakesTheDetailAndTheInvitationNotFoundExactlyLikeAnUnknownSuggestion()
            throws Exception {
        jdbc.update("UPDATE candidates SET search_status = ? WHERE id = ?", SearchStatus.NOT_LOOKING.getCode(),
                candidateId);

        mockMvc.perform(get(PROFILE, offerId, suggestionId).with(as(offer.creatorId())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Suggested candidate not found."));
        mockMvc.perform(get(PROFILE, offerId, UUID.randomUUID()).with(as(offer.creatorId())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Suggested candidate not found."));
        mockMvc.perform(post(INVITE, offerId, suggestionId).with(as(offer.creatorId())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Suggested candidate not found."));
        mockMvc.perform(post(INVITE, offerId, UUID.randomUUID()).with(as(offer.creatorId())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Suggested candidate not found."));
        assertThat(storedStatus()).isEqualTo("1");
        assertThat(jdbc.queryForObject("SELECT invited_by_user_id FROM offer_candidate WHERE id = ?", UUID.class,
                suggestionId)).isNull();

        // Un candidat qui cherche de nouveau redevient visible, tel quel.
        jdbc.update("UPDATE candidates SET search_status = ? WHERE id = ?", SearchStatus.SELECTIVE.getCode(),
                candidateId);
        mockMvc.perform(get(PROFILE, offerId, suggestionId).with(as(offer.creatorId())))
                .andExpect(status().isOk());
    }

    @Test
    void theCardOfTheDetailCarriesTheCurrentFicheNotTheOneComparedByTheScreening() throws Exception {
        data.candidateFiche(candidateId, 2, """
                {"schemaVersion":"3","title":"Principal Engineer","seniority":"lead","yearsOfExperience":12,
                 "location":{"country":"Germany"},"skills":[{"name":"Rust","category":"hard_skill","level":5}]}""");

        mockMvc.perform(get(PROFILE, offerId, suggestionId).with(as(offer.creatorId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.card.id").value(suggestionId.toString()))
                .andExpect(jsonPath("$.card.rank").value(1))
                .andExpect(jsonPath("$.card.title").value("Principal Engineer"))
                .andExpect(jsonPath("$.card.seniority").value("lead"))
                .andExpect(jsonPath("$.card.yearsOfExperience").value(12))
                .andExpect(jsonPath("$.card.country").value("Germany"))
                .andExpect(jsonPath("$.card.skills[0].name").value("Rust"));
        // L'invitation renvoie la même carte que le détail : une seule source, la fiche courante.
        mockMvc.perform(post(INVITE, offerId, suggestionId).with(as(offer.creatorId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Principal Engineer"))
                .andExpect(jsonPath("$.status").value("invited"));
    }

    @Test
    void theInvitationWriteItselfRefusesACandidateWhoIsNoLongerVisible() {
        UUID inviter = offer.creatorId();

        // Consentement retiré : le CAS n'écrit rien, la ligne reste SUGGESTED.
        data.setConsent(candidateId, false);
        assertThat(cas(inviter)).isZero();
        assertThat(storedStatus()).isEqualTo("1");

        // Consentement rendu mais candidat not_looking : refusé aussi.
        data.setConsent(candidateId, true);
        jdbc.update("UPDATE candidates SET search_status = 3 WHERE id = ?", candidateId);
        assertThat(cas(inviter)).isZero();
        assertThat(storedStatus()).isEqualTo("1");
        assertThat(jdbc.queryForObject("SELECT invited_at IS NULL FROM offer_candidate WHERE id = ?",
                Boolean.class, suggestionId)).isTrue();

        // Contrôle positif : statut jamais renseigné (NULL) + consentement -> exactement une ligne écrite.
        jdbc.update("UPDATE candidates SET search_status = NULL WHERE id = ?", candidateId);
        assertThat(cas(inviter)).isEqualTo(1);
        assertThat(storedStatus()).isEqualTo("2");
        assertThat(jdbc.queryForObject("SELECT invited_by_user_id FROM offer_candidate WHERE id = ?", UUID.class,
                suggestionId)).isEqualTo(inviter);

        // Déjà invité : le CAS (attend SUGGESTED) n'écrit plus rien, même pour un candidat visible.
        assertThat(cas(inviter)).isZero();
    }

    private int cas(UUID invitedBy) {
        return new TransactionTemplate(transactionManager).execute(status -> offerCandidateRepository.casInvite(
                suggestionId, offerId, invitedBy, (short) OfferCandidateStatus.SUGGESTED.getCode(),
                (short) OfferCandidateStatus.INVITED.getCode(), LocalDateTime.now(),
                SearchStatus.NOT_LOOKING.getCode()));
    }

    private String storedStatus() {
        return jdbc.queryForObject("SELECT status FROM offer_candidate WHERE id = ?", String.class, suggestionId);
    }

    @Test
    void anInvitationAlreadySentSurvivesTheWithdrawalOnTheCandidateSide() throws Exception {
        mockMvc.perform(post(INVITE, offerId, suggestionId).with(as(offer.creatorId())))
                .andExpect(status().isCreated());

        data.setConsent(candidateId, false);

        mockMvc.perform(get(MY_INVITATIONS).with(as(candidateId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId())))
                .andExpect(jsonPath("$.items").isEmpty());
    }
}

package com.linqorbit.screening.service;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Population <b>éligible</b> du screening pour une offre : les candidats que
 * {@code ScreeningRepository.findTopCandidates} peut retourner, sans distance
 * ni {@code LIMIT}. C'est le même {@code WHERE} que la production, en <b>une seule
 * copie de test</b> partagée par le rapport de rappel ({@code ScreeningRecallReport})
 * et par le test d'équivalence de {@code ScreeningIntegrationTest} : le protocole
 * de mesure ne peut pas dériver de la requête sans que ce test casse.
 */
final class ScreeningEligiblePopulation {

    private ScreeningEligiblePopulation() {
    }

    static Set<UUID> eligibleCandidates(JdbcTemplate jdbc, UUID offerId, String modelName, String modelVersion,
            String strategyVersion, int excludedSearchStatus) {
        return new HashSet<>(jdbc.queryForList("""
                select distinct l.candidate_id
                from candidates c
                join normalized_profile_candidate l on l.candidate_id = c.id
                join normalized_profile np on np.normalized_profile_id = l.normalized_profile_id
                join profile_embedding e on e.normalized_profile_id = np.normalized_profile_id
                where np.content is not null
                  and np.version = (select max(n2.version) from normalized_profile n2
                                    join normalized_profile_candidate l2
                                      on l2.normalized_profile_id = n2.normalized_profile_id
                                    where l2.candidate_id = l.candidate_id and n2.content is not null)
                  and e.model_name = ? and e.model_version = ? and e.strategy_version = ?
                  and vector_norm(e.embedding) > 0
                  and c.recruiter_visibility_consent_at is not null
                  and c.search_status is distinct from ?
                  and not exists (select 1 from application a
                                  where a.candidate_id = c.id and a.job_offer_id = ?)
                  and not exists (select 1 from offer_candidate oc
                                  where oc.candidate_id = c.id and oc.job_offer_id = ?)""", UUID.class,
                modelName, modelVersion, strategyVersion, excludedSearchStatus, offerId, offerId));
    }
}

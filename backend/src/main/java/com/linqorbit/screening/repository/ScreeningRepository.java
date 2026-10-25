package com.linqorbit.screening.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import com.linqorbit.embedding.entity.ProfileEmbedding;

/**
 * Recherche vectorielle du screening (SPEC §8.4.7, D55). Une seule requête
 * native : les mocks ne voient pas le SQL, elle se valide sur PostgreSQL réel.
 */
public interface ScreeningRepository extends Repository<ProfileEmbedding, UUID> {

    /** Ligne du Top N (alias exacts : le SQL natif ne passe pas par les entités). */
    interface Row {
        UUID getCandidateId();

        UUID getNormalizedProfileId();

        double getDistance();
    }

    /**
     * Top N des candidats les plus proches de la <b>fiche courante de l'offre</b>
     * (cosinus, scan séquentiel — aucun index vectoriel au MVP).
     *
     * <p>La jointure est <b>stricte</b> et c'est elle qui garantit
     * l'invariant « un vecteur périmé n'est jamais sélectionnable » :</p>
     * <ul>
     *   <li>côté candidat, seule la <b>dernière fiche avec contenu</b> de chaque
     *       candidat est jointe (une version plus ancienne, ou plus récente mais
     *       encore en analyse, ne l'est jamais) ;</li>
     *   <li>seuls les vecteurs du <b>modèle, de la version et de la stratégie
     *       actifs</b> sont lus (un autre modèle vit dans un autre espace) ;</li>
     *   <li>côté offre, même règle : sa fiche courante, au même couple. Sans
     *       vecteur d'offre, la requête ne renvoie aucune ligne ;</li>
     *   <li>(T-102) seuls les candidats qui ont <b>consenti</b> à la visibilité
     *       recruteur sont éligibles : sans consentement, jamais proposé ;</li>
     *   <li>les candidats {@code not_looking} sont exclus ; un statut jamais
     *       renseigné ({@code NULL}) reste éligible ;</li>
     *   <li>(T-101) les candidats qui ont <b>déjà candidaté</b> à cette offre
     *       (toute candidature) et ceux qui figurent déjà dans
     *       {@code offer_candidate} pour elle (invités conservés à la relance)
     *       sont exclus : le Top N ne compte que des personnes à suggérer.</li>
     * </ul>
     * Ordre déterministe : distance puis id candidat.
     *
     * <p><b>Un candidat n'apparaît qu'une fois</b>, même si deux de ses fiches
     * portent la même « dernière version » : les versions sont numérotées par
     * le service sous verrou, mais aucune contrainte {@code UNIQUE(propriétaire,
     * version)} ne protège la base (V9) et des doublons existent. On garde alors
     * la fiche la plus proche ; côté offre, la fiche la plus récemment validée.
     * Sans cela un candidat dupliqué réduirait silencieusement le Top N effectif
     * et serait évalué deux fois par le matching.</p>
     */
    @Query(value = """
            with offer_vector as (
                select oe.embedding as embedding
                from profile_embedding oe
                join normalized_profile onp on onp.normalized_profile_id = oe.normalized_profile_id
                join normalized_profile_job_offer o on o.normalized_profile_id = onp.normalized_profile_id
                where o.job_offer_id = :offerId
                  and onp.content is not null
                  and onp.version = (select max(n2.version) from normalized_profile n2
                                     join normalized_profile_job_offer o2
                                       on o2.normalized_profile_id = n2.normalized_profile_id
                                     where o2.job_offer_id = o.job_offer_id and n2.content is not null)
                  and oe.model_name = :modelName
                  and oe.model_version = :modelVersion
                  and oe.strategy_version = :strategyVersion
                order by onp.validated_at desc, oe.id
                limit 1
            )
            select best."candidateId", best."normalizedProfileId", best."distance"
            from (
                select distinct on (l.candidate_id)
                       l.candidate_id as "candidateId",
                       np.normalized_profile_id as "normalizedProfileId",
                       (e.embedding <=> ov.embedding) as "distance"
                from candidates c
                join normalized_profile_candidate l on l.candidate_id = c.id
                join normalized_profile np on np.normalized_profile_id = l.normalized_profile_id
                join profile_embedding e on e.normalized_profile_id = np.normalized_profile_id
                cross join offer_vector ov
                where np.content is not null
                  and np.version = (select max(n2.version) from normalized_profile n2
                                    join normalized_profile_candidate l2
                                      on l2.normalized_profile_id = n2.normalized_profile_id
                                    where l2.candidate_id = l.candidate_id and n2.content is not null)
                  and e.model_name = :modelName
                  and e.model_version = :modelVersion
                  and e.strategy_version = :strategyVersion
                  and c.recruiter_visibility_consent_at is not null
                  and c.search_status is distinct from :excludedSearchStatus
                  and not exists (select 1 from application a
                                  where a.candidate_id = c.id and a.job_offer_id = :offerId)
                  and not exists (select 1 from offer_candidate oc
                                  where oc.candidate_id = c.id and oc.job_offer_id = :offerId)
                order by l.candidate_id, "distance", np.normalized_profile_id
            ) best
            order by best."distance", best."candidateId"
            limit :limit""", nativeQuery = true)
    List<Row> findTopCandidates(UUID offerId, String modelName, String modelVersion, String strategyVersion,
            int excludedSearchStatus, int limit);

    /**
     * La fiche courante de l'offre a-t-elle un vecteur du couple actif ? Même
     * définition de « fiche courante » que {@link #findTopCandidates} : sans
     * vecteur, le screening n'a rien à comparer et attend l'embedding.
     */
    @Query(value = """
            select exists (
                select 1
                from profile_embedding oe
                join normalized_profile onp on onp.normalized_profile_id = oe.normalized_profile_id
                join normalized_profile_job_offer o on o.normalized_profile_id = onp.normalized_profile_id
                where o.job_offer_id = :offerId
                  and onp.content is not null
                  and onp.version = (select max(n2.version) from normalized_profile n2
                                     join normalized_profile_job_offer o2
                                       on o2.normalized_profile_id = n2.normalized_profile_id
                                     where o2.job_offer_id = o.job_offer_id and n2.content is not null)
                  and oe.model_name = :modelName
                  and oe.model_version = :modelVersion
                  and oe.strategy_version = :strategyVersion)""", nativeQuery = true)
    boolean existsCurrentOfferVector(UUID offerId, String modelName, String modelVersion, String strategyVersion);
}

package com.linqorbit.joboffer.repository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import lombok.RequiredArgsConstructor;

import com.linqorbit.joboffer.entity.JobOffer;

/**
 * Recherche paginée des offres (liste recruteur T-70, job board T-77).
 *
 * <p>Requête JPQL <b>construite à la demande</b> : seules les clauses des
 * critères renseignés sont ajoutées, avec des paramètres nommés toujours non
 * nuls. Une clause fourre-tout {@code (:x is null or col = :x)} empêcherait
 * l'usage des index, ferait figer à PostgreSQL un plan générique et exposerait
 * à l'inférence de type d'un paramètre nul ({@code bytea}). Page et
 * {@code count} partagent la même clause {@code where}.
 *
 * <p>{@link #search} charge des entités {@link JobOffer} complètes ;
 * {@link #searchRows} ne lit que les colonnes d'une carte de liste
 * ({@link JobOfferRow}, sans la description — TD-024), avec les mêmes critères.
 */
@Repository
@RequiredArgsConstructor
public class JobOfferSearchRepository {

    private final EntityManager entityManager;

    public Page<JobOffer> search(JobOfferSearch search, Pageable pageable) {
        Where where = where(search);

        TypedQuery<JobOffer> pageQuery = entityManager.createQuery(
                "select o from JobOffer o" + where.clause() + " order by " + search.order().clause(),
                JobOffer.class);
        where.params().forEach(pageQuery::setParameter);
        pageQuery.setFirstResult((int) pageable.getOffset());
        pageQuery.setMaxResults(pageable.getPageSize());
        List<JobOffer> content = pageQuery.getResultList();

        return new PageImpl<>(content, pageable, total(where, pageable, content.size()));
    }

    /** Même recherche que {@link #search}, en lignes légères sans description (TD-024). */
    public Page<JobOfferRow> searchRows(JobOfferSearch search, Pageable pageable) {
        Where where = where(search);

        TypedQuery<JobOfferRow> pageQuery = entityManager.createQuery(
                "select new com.linqorbit.joboffer.repository.JobOfferRow(o.id, o.companyId, o.title, o.status,"
                        + " o.publicId, o.slug, o.createdAt, o.updatedAt, o.expiresAt, o.publishedAt,"
                        + " o.validatedAt, o.seniority, o.city, o.country, o.contractTypeId, o.workModeId,"
                        + " o.employmentTypeId, o.salaryMin, o.salaryMax, o.salaryCurrency, o.salaryPeriod)"
                        + " from JobOffer o" + where.clause() + " order by " + search.order().clause(),
                JobOfferRow.class);
        where.params().forEach(pageQuery::setParameter);
        pageQuery.setFirstResult((int) pageable.getOffset());
        pageQuery.setMaxResults(pageable.getPageSize());
        List<JobOfferRow> content = pageQuery.getResultList();

        return new PageImpl<>(content, pageable, total(where, pageable, content.size()));
    }

    /**
     * Une page incomplète et non vide donne le total sans {@code count} ; une
     * page vide à l'offset 0 vaut 0 ; sinon (page pleine ou hors plage) un
     * {@code count} filtré.
     */
    private long total(Where where, Pageable pageable, int returned) {
        if (returned > 0 && returned < pageable.getPageSize()) {
            return pageable.getOffset() + returned;
        }
        if (returned == 0 && pageable.getOffset() == 0) {
            return 0;
        }
        TypedQuery<Long> countQuery = entityManager.createQuery(
                "select count(o) from JobOffer o" + where.clause(), Long.class);
        where.params().forEach(countQuery::setParameter);
        return countQuery.getSingleResult();
    }

    private static Where where(JobOfferSearch s) {
        List<String> clauses = new ArrayList<>();
        Map<String, Object> params = new HashMap<>();

        if (s.companyIds() != null) {
            clauses.add("o.companyId in :companyIds");
            params.put("companyIds", s.companyIds());
        }
        if (s.status() != null) {
            clauses.add("o.status = :status");
            params.put("status", s.status());
        }
        if (s.publicToday() != null) {
            clauses.add("(o.expiresAt is null or o.expiresAt >= :today)");
            params.put("today", s.publicToday());
        }
        if (s.workModeId() != null) {
            clauses.add("o.workModeId = :workModeId");
            params.put("workModeId", s.workModeId());
        }
        if (s.contractTypeId() != null) {
            clauses.add("o.contractTypeId = :contractTypeId");
            params.put("contractTypeId", s.contractTypeId());
        }
        if (s.employmentTypeId() != null) {
            clauses.add("o.employmentTypeId = :employmentTypeId");
            params.put("employmentTypeId", s.employmentTypeId());
        }
        if (s.seniority() != null) {
            clauses.add("o.seniority = :seniority");
            params.put("seniority", s.seniority());
        }
        if (s.country() != null) {
            clauses.add("o.country = :country");
            params.put("country", s.country());
        }
        if (s.titlePattern() != null) {
            String like = " like :pattern escape '" + JobOfferSearch.LIKE_ESCAPE + "'";
            clauses.add(s.matchCompanyName()
                    ? "(lower(o.title)" + like + " or o.companyId in"
                            + " (select c.id from Company c where lower(c.name)" + like + "))"
                    : "lower(o.title)" + like);
            params.put("pattern", s.titlePattern());
        }
        if (s.expiresFrom() != null) {
            clauses.add("o.expiresAt >= :expiresFrom");
            params.put("expiresFrom", s.expiresFrom());
        }
        if (s.expiresUntil() != null) {
            clauses.add("o.expiresAt <= :expiresUntil");
            params.put("expiresUntil", s.expiresUntil());
        }
        String clause = clauses.isEmpty() ? "" : " where " + String.join(" and ", clauses);
        return new Where(clause, params);
    }

    private record Where(String clause, Map<String, Object> params) {
    }
}

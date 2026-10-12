package com.linqorbit.joboffer.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Offre d'emploi (D4, D12–D14) : appartient à une company, gérée par un
 * recruteur (recruiter_id), cycle de vie DRAFT → VALIDATED → PUBLISHED →
 * CLOSED (D13 : validate ≠ publish). validated_at déclenche la normalisation,
 * published_at la publication. Localisation = city + country ISO, miroir
 * users (D14). Construction : builder uniquement (voir AGENTS), setters
 * réservés aux mises à jour.
 */
@Entity
@Table(name = "job_offer")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class JobOffer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "recruiter_id", nullable = false)
    private UUID recruiterId;

    @Convert(converter = JobOfferStatusConverter.class)
    @Column(name = "status", nullable = false)
    private JobOfferStatus status;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Convert(converter = SeniorityConverter.class)
    @Column(name = "seniority")
    private Seniority seniority;

    @Column(name = "required_exp_year")
    private Integer requiredExpYear;

    @Column(name = "city", length = 255)
    private String city;

    @Column(name = "country", length = 2)
    private String country;

    @Column(name = "contract_type_id")
    private UUID contractTypeId;

    @Column(name = "employment_type_id")
    private UUID employmentTypeId;

    @Column(name = "work_mode_id")
    private UUID workModeId;

    @Column(name = "validated_at")
    private LocalDateTime validatedAt;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "expires_at")
    private LocalDate expiresAt;

    @Column(name = "salary_min")
    private BigDecimal salaryMin;

    @Column(name = "salary_max")
    private BigDecimal salaryMax;

    @Column(name = "salary_currency", length = 3)
    private String salaryCurrency;

    @Convert(converter = SalaryPeriodConverter.class)
    @Column(name = "salary_period")
    private SalaryPeriod salaryPeriod;

    /**
     * Gestion manuelle (pas de {@code @UpdateTimestamp}) : le dirty-flag
     * {@code hasUnvalidatedChanges} compare updatedAt à validatedAt, les deux
     * posés dans la même horloge de service — Hibernate re-daté tout flush et
     * produirait un faux positif.
     */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}

package com.linqorbit.joboffer.entity;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Question de présélection d'une offre (D47) : label, type (5 types au MVP),
 * obligatoire ou non et ordre. Éditables uniquement en DRAFT/VALIDATED —
 * l'édition de l'offre remplace intégralement la liste —, figées dès
 * PUBLISHED/CLOSED, copiées à la duplication. Les questions ne sont pas
 * incluses dans le snapshot de la fiche normalisée d'offre. L'id est assigné
 * par le service (les options l'utilisent comme FK dans la même tx) : jamais
 * d'@GeneratedValue, un id pré-renseigné serait vu comme détaché par
 * Hibernate au merge et refuserait l'INSERT (piège T-58).
 */
@Entity
@Table(name = "job_offer_question")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class JobOfferQuestion {

    @Id
    private UUID id;

    @Column(name = "job_offer_id", nullable = false)
    private UUID jobOfferId;

    @Column(name = "label", nullable = false, length = 500)
    private String label;

    @Convert(converter = QuestionTypeConverter.class)
    @Column(name = "question_type", nullable = false)
    private QuestionType questionType;

    @Column(name = "is_required", nullable = false)
    private Boolean isRequired;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}

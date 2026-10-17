package com.linqorbit.joboffer.entity;

import java.util.UUID;

import jakarta.persistence.Column;
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
 * Option d'une question de choix (D47) : label, ordre et {@code preferred} —
 * « information recruteur seule » (a choisi / n'a pas choisi l'option
 * préférée), aucun poids ni scoring. uq_joqo_question_id est la cible de la
 * chaîne FK composite des réponses (V20). L'id est assigné par le service :
 * jamais d'@GeneratedValue (piège T-58, miroir de la question).
 */
@Entity
@Table(name = "job_offer_question_option")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class JobOfferQuestionOption {

    @Id
    private UUID id;

    @Column(name = "question_id", nullable = false)
    private UUID questionId;

    @Column(name = "label", nullable = false, length = 500)
    private String label;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(name = "preferred", nullable = false)
    private Boolean preferred;
}

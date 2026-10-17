package com.linqorbit.application.entity;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Sélection d'une réponse à une question à choix (D48) : PK composite
 * (réponse, option). La chaîne FK composite verrouille l'appartenance —
 * (application_answer_id, question_id) → answer(id, question_id) et
 * (question_id, option_id) → option(question_id, id) : une option d'une autre
 * question (donc d'une autre offre) est impossible à insérer. Les identifiants
 * restent en brut, comme {@code JobOfferSkill} : aucun proxy JPA.
 */
@Entity
@Table(name = "application_answer_option")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
@IdClass(ApplicationAnswerOptionId.class)
public class ApplicationAnswerOption {

    @Id
    @Column(name = "application_answer_id", nullable = false)
    private UUID applicationAnswerId;

    @Id
    @Column(name = "option_id", nullable = false)
    private UUID optionId;

    @Column(name = "question_id", nullable = false)
    private UUID questionId;
}

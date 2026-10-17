package com.linqorbit.application.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;

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
 * Réponse de candidature (D48) : au plus une valeur parmi les trois scalaires
 * (CHECK num_nonnulls ≤ 1) — les questions à choix logent leurs sélections
 * dans {@link ApplicationAnswerOption}. Immuable : pas d'updated_at, l'édition
 * n'existe pas (snapshot de soumission). job_offer_id est un maillon de la
 * chaîne FK composite : (job_offer_id, application_id) → application et
 * (job_offer_id, question_id) → question — une réponse ne peut concerner
 * qu'une question de l'offre de sa candidature. L'id est assigné par le
 * service (les sélections l'utilisent comme FK dans la même tx) : jamais
 * d'@GeneratedValue (piège T-58).
 */
@Entity
@Table(name = "application_answer")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class ApplicationAnswer {

    @Id
    private UUID id;

    @Column(name = "application_id", nullable = false)
    private UUID applicationId;

    @Column(name = "job_offer_id", nullable = false)
    private UUID jobOfferId;

    @Column(name = "question_id", nullable = false)
    private UUID questionId;

    @Column(name = "answer_text", columnDefinition = "TEXT")
    private String answerText;

    @Column(name = "answer_number", precision = 12, scale = 2)
    private BigDecimal answerNumber;

    @Column(name = "answer_boolean")
    private Boolean answerBoolean;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}

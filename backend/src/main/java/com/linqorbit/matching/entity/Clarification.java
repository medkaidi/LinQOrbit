package com.linqorbit.matching.entity;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;

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
 * Question de clarification IA (D52–D53, T-62) : posée par l'agent après
 * une analyse, une seule OPEN par matching (index partiel V22).
 * {@code matchingResultId} = le résultat qui a motivé la question ;
 * {@code rationale} = pourquoi elle est posée, texte destiné au candidat.
 * Historique append-only : une question n'est jamais supprimée, seul son
 * statut évolue (OPEN → ANSWERED | SKIPPED).
 */
@Entity
@Table(name = "clarification")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class Clarification {

    @Id
    private UUID id;

    @Column(name = "matching_id", nullable = false)
    private UUID matchingId;

    @Column(name = "matching_result_id", nullable = false)
    private UUID matchingResultId;

    @Column(name = "question", nullable = false, length = 500)
    private String question;

    @Column(name = "answer", length = 3000)
    private String answer;

    @Column(name = "rationale", length = 700)
    private String rationale;

    @Convert(converter = ClarificationStatusConverter.class)
    @Column(name = "status", nullable = false)
    private ClarificationStatus status;

    @Column(name = "answered_at")
    private LocalDateTime answeredAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}

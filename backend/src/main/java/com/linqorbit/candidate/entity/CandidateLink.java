package com.linqorbit.candidate.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import com.linqorbit.candidate.entity.Candidate;
import com.linqorbit.candidate.entity.LinkType;
import com.linqorbit.candidate.entity.LinkTypeConverter;

/**
 * Lien ou certification du profil candidat (LinkedIn, GitHub, site perso, certif…).
 * issuer et issued_at ne concernent que le type CERTIFICATION.
 */
@Entity
@Table(name = "candidate_links")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class CandidateLink {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    @Column(name = "label", nullable = false, length = 255)
    private String label;

    @Column(name = "url", nullable = false, length = 500)
    private String url;

    @Convert(converter = LinkTypeConverter.class)
    @Column(name = "link_type", nullable = false)
    private LinkType linkType;

    @Column(name = "issuer", length = 255)
    private String issuer;

    @Column(name = "issued_at")
    private LocalDate issuedAt;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}

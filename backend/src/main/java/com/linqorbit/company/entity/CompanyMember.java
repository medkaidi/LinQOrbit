package com.linqorbit.company.entity;

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
 * Appartenance d'un recruteur à une company (D11) : member ou owner — rôle
 * coarse seulement (D12), aucune permission fine. Les identifiants sont portés
 * en brut (UUID), comme {@code UserRole} : aucun proxy JPA dans les requêtes.
 */
@Entity
@Table(name = "company_members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
@IdClass(CompanyMemberId.class)
public class CompanyMember {

    @Id
    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Id
    @Column(name = "recruiter_id", nullable = false)
    private UUID recruiterId;

    @Column(name = "is_owner", nullable = false)
    private Boolean isOwner;

    public static CompanyMember owner(UUID companyId, UUID recruiterId) {
        return CompanyMember.builder().companyId(companyId).recruiterId(recruiterId).isOwner(true).build();
    }
}

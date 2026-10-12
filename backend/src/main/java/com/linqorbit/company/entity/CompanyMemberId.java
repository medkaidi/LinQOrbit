package com.linqorbit.company.entity;

import java.io.Serializable;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Clé composite de {@code company_members} : (company, recruteur) — un
 * recruteur n'est lié qu'une fois à la même company, mais peut appartenir à
 * plusieurs companies (pas d'unicité sur {@code recruiter_id}).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class CompanyMemberId implements Serializable {

    private UUID companyId;
    private UUID recruiterId;
}

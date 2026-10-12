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
 * Nature du contrat d'une offre (D14) : vocabulaire fermé, seed en V12, sans
 * endpoint d'écriture. Construction : builder uniquement (voir AGENTS).
 */
@Entity
@Table(name = "contract_type")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class ContractType {

    @Id
    private UUID id;

    @Column(name = "label", nullable = false, length = 100)
    private String label;
}

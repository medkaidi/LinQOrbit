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
 * Mode de travail d'une offre (D14) : Remote / Hybrid / On-site — vocabulaire
 * fermé, seed en V12, sans endpoint d'écriture. Construction : builder
 * uniquement (voir AGENTS).
 */
@Entity
@Table(name = "work_mode")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class WorkMode {

    @Id
    private UUID id;

    @Column(name = "label", nullable = false, length = 100)
    private String label;
}

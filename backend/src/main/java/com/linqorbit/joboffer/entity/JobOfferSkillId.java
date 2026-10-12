package com.linqorbit.joboffer.entity;

import java.io.Serializable;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Clé composite de {@code job_offer_skill} : (offre, compétence) — une
 * compétence n'existe qu'une fois par offre.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class JobOfferSkillId implements Serializable {

    private UUID jobOfferId;
    private UUID skillId;
}

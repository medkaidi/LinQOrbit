package com.linqorbit.joboffer.entity;

import java.io.Serializable;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Clé composite de {@code normalized_profile_job_offer} : (profil, offre) —
 * un profil n'est lié qu'une fois à la même offre.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class NormalizedProfileJobOfferId implements Serializable {

    private UUID normalizedProfileId;
    private UUID jobOfferId;
}

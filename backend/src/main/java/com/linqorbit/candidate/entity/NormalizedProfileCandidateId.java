package com.linqorbit.candidate.entity;

import java.io.Serializable;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Clé composite de {@code normalized_profile_candidate} : (profil, candidat) —
 * un profil n'est lié qu'une fois au même candidat.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class NormalizedProfileCandidateId implements Serializable {

    private UUID normalizedProfileId;
    private UUID candidateId;
}

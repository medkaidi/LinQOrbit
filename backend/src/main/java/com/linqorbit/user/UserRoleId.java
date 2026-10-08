package com.linqorbit.user;

import java.io.Serializable;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Clé composite de {@code user_roles} : (user_id, role) — un même compte peut
 * cumuler plusieurs rôles, jamais le même deux fois. Le rôle y est porté par son
 * code SMALLINT (les types JPA des clés ne passent pas par AttributeConverter,
 * voir {@link UserRole}).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class UserRoleId implements Serializable {

    private UUID userId;
    private Short role;
}

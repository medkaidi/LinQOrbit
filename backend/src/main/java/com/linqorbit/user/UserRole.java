package com.linqorbit.user;

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
 * Ligne de rôle de capacité (RBAC) : plusieurs lignes par compte possible
 * (cumul ADMIN + futurs rôles). Le code SMALLINT est stocké brut (jamais
 * d'AttributeConverter sur un champ {@code @Id}, interdit par JPA) — la
 * conversion vers {@link Role} se fait aux bords, via {@link #of} /
 * {@link #roleEnum}. Ne porte jamais l'identité candidat/recruteur.
 */
@Entity
@Table(name = "user_roles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
@IdClass(UserRoleId.class)
public class UserRole {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Id
    @Column(name = "role", nullable = false)
    private Short role;

    public static UserRole of(UUID userId, Role role) {
        return UserRole.builder().userId(userId).role((short) role.getCode()).build();
    }

    public Role roleEnum() {
        return Role.fromCode(role);
    }
}

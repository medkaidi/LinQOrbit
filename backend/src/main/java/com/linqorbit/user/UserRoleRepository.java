package com.linqorbit.user;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRoleRepository extends JpaRepository<UserRole, UserRoleId> {

    List<UserRole> findByUserId(UUID userId);

    /** Rôles de plusieurs comptes en une requête (page de la liste admin). */
    List<UserRole> findByUserIdIn(Collection<UUID> userIds);

    boolean existsByRole(Short role);

    /** Tableau de bord admin : comptes portant ce rôle. */
    long countByRole(Short role);
}

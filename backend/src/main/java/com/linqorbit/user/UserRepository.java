package com.linqorbit.user;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    /** Tableau de bord admin : comptes par statut, un seul GROUP BY. Un statut absent vaut 0. */
    @Query("select u.status, count(u) from User u group by u.status")
    List<Object[]> countByStatus();

    /** Tableau de bord admin : comptes créés à partir de {@code since} (borne incluse). */
    long countByCreatedAtGreaterThanEqual(LocalDateTime since);

    /**
     * Page des comptes triée par nom puis prénom (liste admin), filtrable
     * (T-48) : {@code pattern} est le motif LIKE « %terme% » déjà minusculé
     * (construit par le service — jamais un paramètre brut dans un CONCAT,
     * dont le type non inféré casse PostgreSQL sur valeur null), {@code status}
     * et {@code capability} sont optionnels — {@code null} = pas de filtre. La
     * capacité est l'identité (tables candidates / recruiters), jamais un rôle.
     */
    @Query("""
            SELECT u FROM User u
            WHERE (:pattern IS NULL
                    OR LOWER(u.firstName) LIKE :pattern
                    OR LOWER(u.lastName) LIKE :pattern
                    OR LOWER(u.email) LIKE :pattern)
              AND (:status IS NULL OR u.status = :status)
              AND (:capability IS NULL
                    OR (:capability = 'candidate' AND EXISTS (
                            SELECT c.id FROM Candidate c WHERE c.id = u.id))
                    OR (:capability = 'recruiter' AND EXISTS (
                            SELECT r.id FROM Recruiter r WHERE r.id = u.id)))
            ORDER BY u.lastName, u.firstName
            """)
    Page<User> searchUsers(@Param("pattern") String pattern, @Param("status") UserStatus status,
            @Param("capability") String capability, Pageable pageable);
}

package com.linqorbit.user;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    /** Page des comptes triée par nom puis prénom (liste admin). */
    Page<User> findAllByOrderByLastNameAscFirstNameAsc(Pageable pageable);
}

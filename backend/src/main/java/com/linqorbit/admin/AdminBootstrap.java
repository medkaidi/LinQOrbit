package com.linqorbit.admin;

import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.user.Role;
import com.linqorbit.user.User;
import com.linqorbit.user.UserRepository;
import com.linqorbit.user.UserRole;
import com.linqorbit.user.UserRoleRepository;
import com.linqorbit.user.UserStatus;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Garant de l'accès à l'administration : au démarrage, s'assure qu'au moins un
 * compte porte le rôle ADMIN (sinon personne ne peut ouvrir la page, cas
 * perdu-nirn). Idempotent — exécuté à chaque boot, ne crée jamais deux comptes.
 * Identifiants via {@code app.admin.*} (env {@code ADMIN_EMAIL} / {@code ADMIN_PASSWORD}).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminBootstrap implements CommandLineRunner {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.email}")
    private String adminEmail;

    @Value("${app.admin.password}")
    private String adminPassword;

    @Override
    @Transactional
    public void run(String... args) {
        if (userRoleRepository.existsByRole((short) Role.ADMIN.getCode())) {
            return;
        }
        String email = adminEmail.trim().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User created = userRepository.save(User.builder()
                    .email(email)
                    .passwordHash(passwordEncoder.encode(adminPassword))
                    .firstName("Platform")
                    .lastName("Admin")
                    .status(UserStatus.ACTIVE)
                    .build());
            log.info("Admin account created : userId={}, email={}", created.getId(), email);
            return created;
        });
        userRoleRepository.save(UserRole.of(user.getId(), Role.ADMIN));
        log.warn("Admin role granted : userId={}, email={}", user.getId(), email);
    }
}

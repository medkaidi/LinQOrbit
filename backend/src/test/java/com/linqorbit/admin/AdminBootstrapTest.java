package com.linqorbit.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import com.linqorbit.user.Role;
import com.linqorbit.user.User;
import com.linqorbit.user.UserRepository;
import com.linqorbit.user.UserRole;
import com.linqorbit.user.UserRoleRepository;
import com.linqorbit.user.UserStatus;

class AdminBootstrapTest {

    private UserRepository userRepository;
    private UserRoleRepository userRoleRepository;
    private PasswordEncoder passwordEncoder;
    private AdminBootstrap bootstrap;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        userRoleRepository = mock(UserRoleRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        bootstrap = new AdminBootstrap(userRepository, userRoleRepository, passwordEncoder);
        ReflectionTestUtils.setField(bootstrap, "adminEmail", " Admin@Linqorbit.local ");
        ReflectionTestUtils.setField(bootstrap, "adminPassword", "secret-admin");
    }

    @Test
    void neRienQuandUnRoleAdminExisteDeja() {
        when(userRoleRepository.existsByRole((short) 1)).thenReturn(true);

        bootstrap.run();

        verify(userRoleRepository, never()).save(any(UserRole.class));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void creeLeCompteAdminEtAccordeLeRole() {
        when(userRoleRepository.existsByRole((short) 1)).thenReturn(false);
        when(userRepository.findByEmail("admin@linqorbit.local")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("secret-admin")).thenReturn("hash-admin");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User created = invocation.getArgument(0);
            created.setId(UUID.randomUUID());
            return created;
        });
        when(userRoleRepository.save(any(UserRole.class))).thenAnswer(invocation -> invocation.getArgument(0));

        bootstrap.run();

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User created = userCaptor.getValue();
        assertThat(created.getEmail()).isEqualTo("admin@linqorbit.local");
        assertThat(created.getPasswordHash()).isEqualTo("hash-admin");
        assertThat(created.getStatus()).isEqualTo(UserStatus.ACTIVE);

        org.mockito.ArgumentCaptor<UserRole> roleCaptor = ArgumentCaptor.forClass(UserRole.class);
        verify(userRoleRepository).save(roleCaptor.capture());
        assertThat(roleCaptor.getValue().getUserId()).isEqualTo(created.getId());
        assertThat(roleCaptor.getValue().roleEnum()).isEqualTo(Role.ADMIN);
    }

    @Test
    void accordeLeRoleAuCompteExistantSansLeRecreer() {
        UUID existingId = UUID.randomUUID();
        User existing = User.builder().id(existingId).email("admin@linqorbit.local")
                .status(UserStatus.ACTIVE).build();
        when(userRoleRepository.existsByRole((short) 1)).thenReturn(false);
        when(userRepository.findByEmail("admin@linqorbit.local")).thenReturn(Optional.of(existing));

        bootstrap.run();

        verify(userRepository, never()).save(any(User.class));
        verify(passwordEncoder, never()).encode(any());
        org.mockito.ArgumentCaptor<UserRole> roleCaptor = ArgumentCaptor.forClass(UserRole.class);
        verify(userRoleRepository).save(roleCaptor.capture());
        assertThat(roleCaptor.getValue().getUserId()).isEqualTo(existingId);
        assertThat(roleCaptor.getValue().roleEnum()).isEqualTo(Role.ADMIN);
    }
}

package com.linqorbit.recruiter.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.linqorbit.recruiter.dto.RecruiterResponse;
import com.linqorbit.recruiter.dto.UpdateRecruiterRequest;
import com.linqorbit.recruiter.entity.Recruiter;
import com.linqorbit.recruiter.exception.RecruiterAlreadyExistsException;
import com.linqorbit.recruiter.exception.RecruiterNotFoundException;
import com.linqorbit.recruiter.mapper.RecruiterMapper;
import com.linqorbit.recruiter.repository.RecruiterRepository;

class RecruiterServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-4111-8111-111111111111");

    private RecruiterRepository recruiterRepository;
    private RecruiterMapper recruiterMapper;
    private RecruiterService recruiterService;

    @BeforeEach
    void setUp() {
        recruiterRepository = mock(RecruiterRepository.class);
        recruiterMapper = mock(RecruiterMapper.class);
        recruiterService = new RecruiterService(recruiterRepository, recruiterMapper);
    }

    @Test
    void createCreeLaLigneAvecLIdentitePartagee() {
        when(recruiterRepository.existsById(USER_ID)).thenReturn(false);
        Recruiter saved = Recruiter.builder().id(USER_ID).build();
        when(recruiterRepository.save(any(Recruiter.class))).thenReturn(saved);
        when(recruiterMapper.toRecruiterResponse(saved)).thenReturn(new RecruiterResponse(USER_ID, null, null));

        RecruiterResponse response = recruiterService.create(USER_ID);

        assertThat(response.id()).isEqualTo(USER_ID);
        ArgumentCaptor<Recruiter> captor = ArgumentCaptor.forClass(Recruiter.class);
        verify(recruiterRepository).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(USER_ID);
    }

    @Test
    void createRejetteUnDoublon() {
        when(recruiterRepository.existsById(USER_ID)).thenReturn(true);

        assertThatThrownBy(() -> recruiterService.create(USER_ID))
                .isInstanceOf(RecruiterAlreadyExistsException.class);
    }

    @Test
    void getRenvoieLeProfil() {
        Recruiter recruiter = Recruiter.builder().id(USER_ID).headline("Talent Acquisition").bio("Hello").build();
        when(recruiterRepository.findById(USER_ID)).thenReturn(Optional.of(recruiter));
        when(recruiterMapper.toRecruiterResponse(recruiter))
                .thenReturn(new RecruiterResponse(USER_ID, "Talent Acquisition", "Hello"));

        RecruiterResponse response = recruiterService.get(USER_ID);

        assertThat(response.headline()).isEqualTo("Talent Acquisition");
        assertThat(response.bio()).isEqualTo("Hello");
    }

    @Test
    void getRejetteUnCompteSansProfilRecruteur() {
        when(recruiterRepository.findById(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> recruiterService.get(USER_ID))
                .isInstanceOf(RecruiterNotFoundException.class);
    }

    @Test
    void updateEcritHeadlineEtBio() {
        Recruiter recruiter = Recruiter.builder().id(USER_ID).headline("Old").build();
        when(recruiterRepository.findById(USER_ID)).thenReturn(Optional.of(recruiter));
        when(recruiterRepository.save(any(Recruiter.class))).thenReturn(recruiter);

        recruiterService.update(USER_ID, new UpdateRecruiterRequest("  New headline  ", "  Ma bio  "));

        assertThat(recruiter.getHeadline()).isEqualTo("New headline");
        assertThat(recruiter.getBio()).isEqualTo("Ma bio");
    }

    @Test
    void updateConvertitLaChaineVideEnEffacement() {
        Recruiter recruiter = Recruiter.builder().id(USER_ID).headline("Old").bio("Ancienne").build();
        when(recruiterRepository.findById(USER_ID)).thenReturn(Optional.of(recruiter));
        when(recruiterRepository.save(any(Recruiter.class))).thenReturn(recruiter);

        recruiterService.update(USER_ID, new UpdateRecruiterRequest("", null));

        assertThat(recruiter.getHeadline()).isNull();
        assertThat(recruiter.getBio()).isEqualTo("Ancienne");
    }

    @Test
    void updateRejetteUnCompteSansProfilRecruteur() {
        when(recruiterRepository.findById(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> recruiterService.update(USER_ID, new UpdateRecruiterRequest("X", null)))
                .isInstanceOf(RecruiterNotFoundException.class);
    }
}

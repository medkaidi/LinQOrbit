package com.linqorbit.recruiter.service;

import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.recruiter.dto.RecruiterResponse;
import com.linqorbit.recruiter.dto.UpdateRecruiterRequest;
import com.linqorbit.recruiter.entity.Recruiter;
import com.linqorbit.recruiter.exception.RecruiterAlreadyExistsException;
import com.linqorbit.recruiter.exception.RecruiterNotFoundException;
import com.linqorbit.recruiter.mapper.RecruiterMapper;
import com.linqorbit.recruiter.repository.RecruiterRepository;

/**
 * Profil recruteur (identité D10) : la ligne {@code recruiters} est créée par
 * une action explicite du compte (jamais à la lecture, jamais au signup) — le
 * même jour où il bascule dans l'espace recruteur, le frontend appelle
 * POST /me s'il reçoit un 404 sur GET /me (onboarding D16).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecruiterService {

    private final RecruiterRepository recruiterRepository;
    private final RecruiterMapper recruiterMapper;

    @Transactional
    public RecruiterResponse create(UUID userId) {
        log.info("Recruiter profile creation requested : userId={}", userId);
        if (recruiterRepository.existsById(userId)) {
            log.warn("Recruiter profile creation rejected : already exists, userId={}", userId);
            throw new RecruiterAlreadyExistsException();
        }
        Recruiter saved = recruiterRepository.save(Recruiter.builder().id(userId).build());
        log.info("Recruiter profile created : userId={}", userId);
        return recruiterMapper.toRecruiterResponse(saved);
    }

    @Transactional(readOnly = true)
    public RecruiterResponse get(UUID userId) {
        Recruiter recruiter = recruiterRepository.findById(userId).orElse(null);
        if (recruiter == null) {
            log.warn("Recruiter profile lookup failed : not found, userId={}", userId);
            throw new RecruiterNotFoundException();
        }
        return recruiterMapper.toRecruiterResponse(recruiter);
    }

    @Transactional
    public void update(UUID userId, UpdateRecruiterRequest request) {
        log.info("Recruiter profile update requested : userId={}", userId);
        Recruiter recruiter = recruiterRepository.findById(userId).orElse(null);
        if (recruiter == null) {
            log.warn("Recruiter profile update rejected : not found, userId={}", userId);
            throw new RecruiterNotFoundException();
        }
        if (request.headline() != null) {
            recruiter.setHeadline(trimToNull(request.headline()));
        }
        if (request.bio() != null) {
            recruiter.setBio(trimToNull(request.bio()));
        }
        recruiterRepository.save(recruiter);
        log.info("Recruiter profile updated : userId={}", userId);
    }

    /**
     * Chaîne vide = effacée (null en base) ; null = champ non fourni, conservé.
     */
    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

package com.linqorbit.joboffer.service;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.joboffer.dto.LabelOption;
import com.linqorbit.joboffer.repository.ContractTypeRepository;
import com.linqorbit.joboffer.repository.EmploymentTypeRepository;
import com.linqorbit.joboffer.repository.WorkModeRepository;

/**
 * Listes de référence d'offre (D14) : lectures seules, alimentées par le seed
 * V12 — aucun endpoint d'écriture, enrichissement = migration ultérieure.
 */
@Service
@RequiredArgsConstructor
public class JobOfferReferenceService {

    private final ContractTypeRepository contractTypeRepository;
    private final EmploymentTypeRepository employmentTypeRepository;
    private final WorkModeRepository workModeRepository;

    @Transactional(readOnly = true)
    public List<LabelOption> contractTypes() {
        return contractTypeRepository.findAll().stream()
                .map(type -> new LabelOption(type.getId(), type.getLabel()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<LabelOption> employmentTypes() {
        return employmentTypeRepository.findAll().stream()
                .map(type -> new LabelOption(type.getId(), type.getLabel()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<LabelOption> workModes() {
        return workModeRepository.findAll().stream()
                .map(mode -> new LabelOption(mode.getId(), mode.getLabel()))
                .toList();
    }
}

package com.linqorbit.company.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

import com.linqorbit.common.security.CurrentUserId;
import com.linqorbit.company.dto.CompanyResponse;
import com.linqorbit.company.dto.CreateCompanyRequest;
import com.linqorbit.company.dto.UpdateCompanyRequest;
import com.linqorbit.company.service.CompanyService;

@RestController
@RequestMapping("/api/v1/companies")
@RequiredArgsConstructor
public class CompanyController implements CompanyApi {

    private final CompanyService companyService;

    @Override
    public ResponseEntity<CompanyResponse> create(CreateCompanyRequest request, Authentication authentication) {
        return ResponseEntity.status(201)
                .body(companyService.create(CurrentUserId.from(authentication), request));
    }

    @Override
    public ResponseEntity<List<CompanyResponse>> listMine(Authentication authentication) {
        return ResponseEntity.ok(companyService.listMine(CurrentUserId.from(authentication)));
    }

    @Override
    public ResponseEntity<CompanyResponse> get(UUID companyId, Authentication authentication) {
        return ResponseEntity.ok(companyService.get(CurrentUserId.from(authentication), companyId));
    }

    @Override
    public ResponseEntity<Void> update(UUID companyId, UpdateCompanyRequest request, Authentication authentication) {
        companyService.update(CurrentUserId.from(authentication), companyId, request);
        return ResponseEntity.noContent().build();
    }
}

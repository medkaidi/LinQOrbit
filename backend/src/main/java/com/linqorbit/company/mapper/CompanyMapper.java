package com.linqorbit.company.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import com.linqorbit.company.dto.CompanyResponse;
import com.linqorbit.company.entity.Company;

@Mapper(componentModel = "spring")
public interface CompanyMapper {

    @Mapping(target = "isOwner", source = "isOwner")
    CompanyResponse toCompanyResponse(Company company, boolean isOwner);
}

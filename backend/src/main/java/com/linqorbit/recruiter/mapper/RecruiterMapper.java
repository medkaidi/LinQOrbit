package com.linqorbit.recruiter.mapper;

import org.mapstruct.Mapper;

import com.linqorbit.recruiter.dto.RecruiterResponse;
import com.linqorbit.recruiter.entity.Recruiter;

@Mapper(componentModel = "spring")
public interface RecruiterMapper {

    RecruiterResponse toRecruiterResponse(Recruiter recruiter);
}

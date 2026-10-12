package com.linqorbit.recruiter.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.recruiter.entity.Recruiter;

public interface RecruiterRepository extends JpaRepository<Recruiter, UUID> {
}

package com.linqorbit.candidate.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.candidate.entity.Degree;

public interface DegreeRepository extends JpaRepository<Degree, UUID> {

    List<Degree> findAllByOrderByLabelAsc();
}

package com.linqorbit.application.entity;

import java.io.Serializable;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Clé composite de {@code application_answer_option} : (réponse, option) —
 * une option n'est sélectionnée qu'une fois par réponse.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class ApplicationAnswerOptionId implements Serializable {

    private UUID applicationAnswerId;
    private UUID optionId;
}

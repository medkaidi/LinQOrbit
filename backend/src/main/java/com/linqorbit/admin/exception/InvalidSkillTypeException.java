package com.linqorbit.admin.exception;

public class InvalidSkillTypeException extends RuntimeException {

    public InvalidSkillTypeException(String skillType) {
        super("Type de compétence invalide : " + skillType);
    }
}

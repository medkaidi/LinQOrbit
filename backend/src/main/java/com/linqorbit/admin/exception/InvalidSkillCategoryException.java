package com.linqorbit.admin.exception;

public class InvalidSkillCategoryException extends RuntimeException {

    public InvalidSkillCategoryException(String category) {
        super("Catégorie inconnue : " + category);
    }
}

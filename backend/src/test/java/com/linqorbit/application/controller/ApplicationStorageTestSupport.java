package com.linqorbit.application.controller;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Racine de stockage partagée par les IT de candidature : la source de
 * propriété dynamique est déclarée une seule fois ici pour que Spring teste
 * les deux classes dans le même contexte (sinon chaque déclaration crée un
 * contexte et un pool Hikari supplémentaires, jusqu'à épuisement des
 * connexions PostgreSQL sur la suite complète).
 */
abstract class ApplicationStorageTestSupport {

    private static final Path STORAGE_ROOT = createStorageRoot();

    @DynamicPropertySource
    static void storageRoot(DynamicPropertyRegistry registry) {
        registry.add("app.attachments.storage-root", () -> STORAGE_ROOT.toString());
    }

    private static Path createStorageRoot() {
        try {
            return Files.createTempDirectory("linqorbit-applications-it");
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }
}

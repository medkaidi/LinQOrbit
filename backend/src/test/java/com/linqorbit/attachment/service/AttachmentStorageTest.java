package com.linqorbit.attachment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.Resource;
import org.springframework.mock.web.MockMultipartFile;

class AttachmentStorageTest {

    @TempDir
    Path tempDir;

    private AttachmentStorage storage;

    @BeforeEach
    void setUp() {
        storage = new AttachmentStorage(tempDir.toString());
    }

    @Test
    void storeEcritLeFichierEtCalculeEmpreinteEtTaille() throws Exception {
        byte[] content = "%PDF-1.4 fake content".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile("file", "cv.pdf", "application/pdf", content);
        UUID candidateId = UUID.randomUUID();
        UUID attachmentId = UUID.randomUUID();

        AttachmentStorage.StoredFile stored = storage.store(candidateId, attachmentId, file);

        assertThat(stored.storagePath()).isEqualTo("candidates/" + candidateId + "/" + attachmentId);
        assertThat(stored.sizeBytes()).isEqualTo(content.length);
        assertThat(stored.sha256()).isEqualTo(sha256Hex(content));
        assertThat(tempDir.resolve(stored.storagePath())).exists();
        assertThat(Files.readAllBytes(tempDir.resolve(stored.storagePath()))).isEqualTo(content);
    }

    @Test
    void loadRetourneUneRessourceExistante() {
        MockMultipartFile file = new MockMultipartFile("file", "cv.pdf", "application/pdf",
                "data".getBytes(StandardCharsets.UTF_8));

        AttachmentStorage.StoredFile stored = storage.store(UUID.randomUUID(), UUID.randomUUID(), file);
        Resource resource = storage.load(stored.storagePath());

        assertThat(resource.exists()).isTrue();
    }

    @Test
    void deleteSupprimeLeFichierEtIgnoreUnCheminDejaAbsent() {
        MockMultipartFile file = new MockMultipartFile("file", "cv.pdf", "application/pdf",
                "data".getBytes(StandardCharsets.UTF_8));
        AttachmentStorage.StoredFile stored = storage.store(UUID.randomUUID(), UUID.randomUUID(), file);

        storage.delete(stored.storagePath());
        assertThat(tempDir.resolve(stored.storagePath())).doesNotExist();

        // Best-effort : supprimer une seconde fois ne jette pas.
        storage.delete(stored.storagePath());
    }

    @Test
    void refuseUnCheminQuiSortDeLaRacine() {
        assertThatThrownBy(() -> storage.load("../../etc/passwd"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> storage.delete("../escape"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static String sha256Hex(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}

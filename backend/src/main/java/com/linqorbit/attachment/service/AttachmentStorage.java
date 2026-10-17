package com.linqorbit.attachment.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import lombok.extern.slf4j.Slf4j;

/**
 * Stockage disque local des pièces jointes (D46). Les fichiers sont écrits sous
 * {racine}/{chemin relatif} — jamais nommés d'après le nom client — et le
 * chemin relatif stocké en base reste valable même si la racine change (les
 * fichiers existants gardent leur dossier). L'empreinte sha256 et la taille
 * réelle sont calculées en un seul passage à l'écriture.
 */
@Slf4j
@Component
public class AttachmentStorage {

    private final Path root;

    public AttachmentStorage(@Value("${app.attachments.storage-root}") String storageRoot) {
        this.root = Paths.get(storageRoot).toAbsolutePath().normalize();
    }

    /** Écrit le fichier et retourne chemin relatif + empreinte + taille réelle. */
    public StoredFile store(UUID candidateId, UUID attachmentId, MultipartFile file) {
        String relativePath = "candidates/" + candidateId + "/" + attachmentId;
        Path target = resolve(relativePath);
        MessageDigest digest = sha256Digest();
        try {
            Files.createDirectories(target.getParent());
            try (InputStream in = file.getInputStream();
                    DigestInputStream digestIn = new DigestInputStream(in, digest);
                    OutputStream out = Files.newOutputStream(target, StandardOpenOption.CREATE_NEW,
                            StandardOpenOption.WRITE)) {
                digestIn.transferTo(out);
            }
            return new StoredFile(relativePath, HexFormat.of().formatHex(digest.digest()), Files.size(target));
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    public Resource load(String storagePath) {
        return new FileSystemResource(resolve(storagePath));
    }

    /** Suppression best-effort : un fichier orphelin est anodin, la ligne fait foi. */
    public void delete(String storagePath) {
        try {
            if (!Files.deleteIfExists(resolve(storagePath))) {
                log.warn("Attachment file already absent on disk : {}", storagePath);
            }
        } catch (IOException ex) {
            log.warn("Attachment file could not be deleted, orphan kept : {} : {}", storagePath, ex.getMessage());
        }
    }

    private Path resolve(String storagePath) {
        Path path = root.resolve(storagePath).normalize();
        if (!path.startsWith(root)) {
            throw new IllegalArgumentException("Attachment path escapes the storage root");
        }
        return path;
    }

    private static MessageDigest sha256Digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is always available", ex);
        }
    }

    /**
     * Résultat d'une écriture : chemin relatif (valeur de storage_path),
     * empreinte sha256 hexadécimale et taille réelle du fichier écrit.
     */
    public record StoredFile(String storagePath, String sha256, long sizeBytes) {
    }
}

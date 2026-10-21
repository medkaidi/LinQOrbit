package com.linqorbit.attachment.service;

import java.util.List;
import java.util.UUID;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.linqorbit.application.entity.ApplicationStatus;
import com.linqorbit.application.repository.ApplicationRepository;
import com.linqorbit.attachment.dto.AttachmentContent;
import com.linqorbit.attachment.dto.AttachmentResponse;
import com.linqorbit.attachment.entity.Attachment;
import com.linqorbit.attachment.exception.AttachmentNotFoundException;
import com.linqorbit.attachment.exception.InvalidAttachmentException;
import com.linqorbit.attachment.repository.AttachmentRepository;
import com.linqorbit.attachment.service.AttachmentStorage.StoredFile;
import com.linqorbit.candidate.service.CandidateService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Pièces jointes du candidat : CV déposés sur disque local, tracés en base.
 * L'upload valide le fichier (PDF, non vide), garantit la ligne candidates,
 * écrit le fichier (sha256 en un passage) puis la ligne attachment, et désigne
 * le nouveau CV comme courant. Remplacer un CV = en déposer un nouveau : les
 * anciens restent listés et téléchargeables. Le pointeur courant passe par un
 * UPDATE bulk — jamais un save d'entité, qui bumperait updated_at et salirait
 * le profil (dirty-flag).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AttachmentService {

    private static final String PDF_CONTENT_TYPE = "application/pdf";
    private static final int MAX_NAME_LENGTH = 255;

    private final AttachmentRepository attachmentRepository;
    private final AttachmentStorage attachmentStorage;
    private final CandidateService candidateService;
    private final ApplicationRepository applicationRepository;

    @Transactional
    public AttachmentResponse upload(UUID userId, MultipartFile file) {
        log.info("CV upload requested : userId={}, fileName={}", userId,
                file == null ? null : file.getOriginalFilename());
        if (file == null || file.isEmpty()) {
            log.warn("CV upload rejected : no file, userId={}", userId);
            throw new InvalidAttachmentException(HttpStatus.BAD_REQUEST, "No file uploaded.");
        }
        if (!PDF_CONTENT_TYPE.equalsIgnoreCase(file.getContentType())) {
            log.warn("CV upload rejected : unsupported type [{}], userId={}", file.getContentType(), userId);
            throw new InvalidAttachmentException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only PDF files are supported.");
        }
        String originalName = sanitizeName(file.getOriginalFilename(), userId);
        UUID candidateId = candidateService.ensureCandidate(userId);
        UUID attachmentId = UUID.randomUUID();
        StoredFile stored = attachmentStorage.store(candidateId, attachmentId, file);
        Attachment attachment = Attachment.builder()
                .id(attachmentId)
                .candidateId(candidateId)
                .originalName(originalName)
                .mimeType(PDF_CONTENT_TYPE)
                .sizeBytes(stored.sizeBytes())
                .sha256(stored.sha256())
                .storagePath(stored.storagePath())
                .build();
        Attachment saved;
        try {
            saved = attachmentRepository.saveAndFlush(attachment);
        } catch (RuntimeException ex) {
            // Pas de fichier orphelin silencieux si la ligne n'a pas pu être écrite.
            attachmentStorage.delete(stored.storagePath());
            throw ex;
        }
        candidateService.setCurrentCvAttachment(userId, attachmentId);
        log.info("CV uploaded : userId={}, attachmentId={}, sizeBytes={}", userId, attachmentId,
                stored.sizeBytes());
        return toResponse(saved, true);
    }

    @Transactional(readOnly = true)
    public List<AttachmentResponse> list(UUID userId) {
        log.info("CV list requested : userId={}", userId);
        UUID currentId = candidateService.getCurrentCvAttachmentId(userId).orElse(null);
        List<AttachmentResponse> attachments = attachmentRepository
                .findByCandidateIdOrderByCreatedAtDescIdDesc(userId).stream()
                .map(attachment -> toResponse(attachment, attachment.getId().equals(currentId)))
                .toList();
        log.info("CV list succeeded : userId={}, count={}", userId, attachments.size());
        return attachments;
    }

    @Transactional(readOnly = true)
    public AttachmentContent download(UUID userId, UUID attachmentId) {
        log.info("CV download requested : userId={}, attachmentId={}", userId, attachmentId);
        Attachment attachment = findOwned(userId, attachmentId);
        Resource resource = attachmentStorage.load(attachment.getStoragePath());
        if (!resource.exists()) {
            log.warn("CV download rejected : file missing on disk, attachmentId={}, path={}",
                    attachmentId, attachment.getStoragePath());
            throw new AttachmentNotFoundException("file missing on disk for attachment " + attachmentId);
        }
        UUID currentId = candidateService.getCurrentCvAttachmentId(userId).orElse(null);
        return new AttachmentContent(toResponse(attachment, attachmentId.equals(currentId)), resource);
    }

    /**
     * Téléchargement d'un CV épinglé par une candidature (T-66). Le contrôle
     * d'accès à l'offre et à la candidature est fait par l'appelant ; cette
     * méthode ne vérifie que l'appartenance du fichier au candidat de la
     * candidature (la FK composite la garantit déjà en base).
     */
    @Transactional(readOnly = true)
    public AttachmentContent downloadPinned(UUID candidateId, UUID attachmentId) {
        log.info("Pinned CV download requested : candidateId={}, attachmentId={}", candidateId, attachmentId);
        Attachment attachment = attachmentRepository.findByIdAndCandidateId(attachmentId, candidateId)
                .orElseThrow(() -> {
                    log.warn("Pinned CV download rejected : unknown attachment for candidate, candidateId={},"
                            + " attachmentId={}", candidateId, attachmentId);
                    return new AttachmentNotFoundException(
                            "attachment " + attachmentId + " not found for candidate " + candidateId);
                });
        Resource resource = attachmentStorage.load(attachment.getStoragePath());
        if (!resource.exists()) {
            log.warn("Pinned CV download rejected : file missing on disk, attachmentId={}, path={}",
                    attachmentId, attachment.getStoragePath());
            throw new AttachmentNotFoundException("file missing on disk for attachment " + attachmentId);
        }
        return new AttachmentContent(toResponse(attachment, false), resource);
    }

    @Transactional
    public void setCurrent(UUID userId, UUID attachmentId) {
        log.info("CV switch requested : userId={}, attachmentId={}", userId, attachmentId);
        if (!attachmentRepository.existsByIdAndCandidateId(attachmentId, userId)) {
            log.warn("CV switch rejected : unknown attachment or not owner, userId={}, attachmentId={}",
                    userId, attachmentId);
            throw new AttachmentNotFoundException(
                    "attachment " + attachmentId + " not found for candidate " + userId);
        }
        candidateService.setCurrentCvAttachment(userId, attachmentId);
        log.info("CV switched : userId={}, attachmentId={}", userId, attachmentId);
    }

    @Transactional
    public void delete(UUID userId, UUID attachmentId) {
        log.info("CV delete requested : userId={}, attachmentId={}", userId, attachmentId);
        Attachment attachment = findOwned(userId, attachmentId);
        // TD-054 : un CV figé par une candidature transmise reste — 409 explicite, jamais un 500 de FK.
        if (applicationRepository.existsByCvAttachmentIdAndStatusNot(attachmentId, ApplicationStatus.DRAFT)) {
            log.warn("CV delete rejected : attached to a sent application, userId={}, attachmentId={}", userId,
                    attachmentId);
            throw new InvalidAttachmentException(HttpStatus.CONFLICT,
                    "This CV is attached to an application you sent and cannot be deleted.");
        }
        int detached = applicationRepository.detachCvFromDrafts(attachmentId, ApplicationStatus.DRAFT);
        if (detached > 0) {
            log.info("CV detached from drafts : userId={}, attachmentId={}, drafts={}", userId, attachmentId, detached);
        }
        attachmentRepository.delete(attachment);
        // Flush explicite : la ligne part avant le fichier. Filet : une candidature
        // transmise entre le contrôle et le DELETE reste protégée par la FK composite (V20).
        attachmentRepository.flush();
        attachmentStorage.delete(attachment.getStoragePath());
        log.info("CV deleted : userId={}, attachmentId={}", userId, attachmentId);
    }

    private Attachment findOwned(UUID userId, UUID attachmentId) {
        return attachmentRepository.findByIdAndCandidateId(attachmentId, userId)
                .orElseThrow(() -> {
                    log.warn("CV access rejected : unknown attachment or not owner, userId={}, attachmentId={}",
                            userId, attachmentId);
                    return new AttachmentNotFoundException(
                            "attachment " + attachmentId + " not found for candidate " + userId);
                });
    }

    /** Nom d'origine assaini : jamais de chemin client, borné à la colonne. */
    private String sanitizeName(String originalFilename, UUID userId) {
        String name = originalFilename == null ? "" : originalFilename.trim();
        int lastSeparator = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        if (lastSeparator >= 0) {
            name = name.substring(lastSeparator + 1);
        }
        if (name.isEmpty()) {
            name = "cv.pdf";
        }
        if (name.length() > MAX_NAME_LENGTH) {
            log.warn("CV upload rejected : file name too long, userId={}, length={}", userId, name.length());
            throw new InvalidAttachmentException(HttpStatus.BAD_REQUEST, "The file name is too long.");
        }
        return name;
    }

    private static AttachmentResponse toResponse(Attachment attachment, boolean current) {
        return new AttachmentResponse(attachment.getId(), attachment.getOriginalName(), attachment.getMimeType(),
                attachment.getSizeBytes(), attachment.getSha256(), attachment.getCreatedAt(), current);
    }
}

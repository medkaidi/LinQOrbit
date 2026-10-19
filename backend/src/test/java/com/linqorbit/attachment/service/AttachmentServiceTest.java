package com.linqorbit.attachment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

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

class AttachmentServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();

    private final AttachmentRepository attachmentRepository = mock(AttachmentRepository.class);
    private final AttachmentStorage attachmentStorage = mock(AttachmentStorage.class);
    private final CandidateService candidateService = mock(CandidateService.class);
    private final ApplicationRepository applicationRepository = mock(ApplicationRepository.class);
    private final AttachmentService attachmentService = new AttachmentService(attachmentRepository, attachmentStorage,
            candidateService, applicationRepository);

    @Test
    void uploadNominalEcritLigneEtFichierEtDeduitLeCvCourant() {
        MockMultipartFile file = pdf("my cv.pdf");
        StoredFile stored = new StoredFile("candidates/x/y", "ab".repeat(32), 14L);
        when(candidateService.ensureCandidate(USER_ID)).thenReturn(USER_ID);
        when(attachmentStorage.store(eq(USER_ID), any(UUID.class), same(file))).thenReturn(stored);
        when(attachmentRepository.saveAndFlush(any(Attachment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AttachmentResponse response = attachmentService.upload(USER_ID, file);

        ArgumentCaptor<Attachment> captor = ArgumentCaptor.forClass(Attachment.class);
        verify(attachmentRepository).saveAndFlush(captor.capture());
        Attachment saved = captor.getValue();
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCandidateId()).isEqualTo(USER_ID);
        assertThat(saved.getOriginalName()).isEqualTo("my cv.pdf");
        assertThat(saved.getMimeType()).isEqualTo("application/pdf");
        assertThat(saved.getSizeBytes()).isEqualTo(14L);
        assertThat(saved.getSha256()).isEqualTo(stored.sha256());
        assertThat(saved.getStoragePath()).isEqualTo(stored.storagePath());

        assertThat(response.id()).isEqualTo(saved.getId());
        assertThat(response.current()).isTrue();
        verify(candidateService).setCurrentCvAttachment(USER_ID, saved.getId());
    }

    @Test
    void uploadNettoieLeFichierSiLaLigneNePeutPasEtreEcrit() {
        MockMultipartFile file = pdf("cv.pdf");
        StoredFile stored = new StoredFile("candidates/x/y", "ab".repeat(32), 14L);
        when(candidateService.ensureCandidate(USER_ID)).thenReturn(USER_ID);
        when(attachmentStorage.store(eq(USER_ID), any(UUID.class), same(file))).thenReturn(stored);
        when(attachmentRepository.saveAndFlush(any(Attachment.class)))
                .thenThrow(new IllegalStateException("database down"));

        assertThatThrownBy(() -> attachmentService.upload(USER_ID, file))
                .isInstanceOf(IllegalStateException.class);

        verify(attachmentStorage).delete(stored.storagePath());
        verify(candidateService, never()).setCurrentCvAttachment(any(), any());
    }

    @Test
    void uploadRejetteUnFichierAbsentEtUnFichierVide() {
        assertThatThrownBy(() -> attachmentService.upload(USER_ID, null))
                .isInstanceOf(InvalidAttachmentException.class)
                .satisfies(ex -> assertThat(((InvalidAttachmentException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_REQUEST));

        MockMultipartFile empty = new MockMultipartFile("file", "cv.pdf", "application/pdf", new byte[0]);
        assertThatThrownBy(() -> attachmentService.upload(USER_ID, empty))
                .isInstanceOf(InvalidAttachmentException.class)
                .satisfies(ex -> assertThat(((InvalidAttachmentException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_REQUEST));

        verifyNoInteractions(attachmentStorage, candidateService);
    }

    @Test
    void uploadRejetteUnFichierNonPdf() {
        MockMultipartFile docx = new MockMultipartFile("file", "cv.docx", "application/msword",
                "data".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> attachmentService.upload(USER_ID, docx))
                .isInstanceOf(InvalidAttachmentException.class)
                .satisfies(ex -> assertThat(((InvalidAttachmentException) ex).getStatus())
                        .isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE));

        verifyNoInteractions(attachmentStorage, candidateService);
    }

    @Test
    void uploadReduitLeNomAuBasenameEtRejetteUnNomTropLong() {
        MockMultipartFile withPath = new MockMultipartFile("file", "C:\\Users\\me\\my cv.pdf",
                "application/pdf", "%PDF-1.4".getBytes(StandardCharsets.UTF_8));
        when(candidateService.ensureCandidate(USER_ID)).thenReturn(USER_ID);
        when(attachmentStorage.store(eq(USER_ID), any(UUID.class), same(withPath)))
                .thenReturn(new StoredFile("candidates/x/y", "ab".repeat(32), 8L));
        when(attachmentRepository.saveAndFlush(any(Attachment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AttachmentResponse response = attachmentService.upload(USER_ID, withPath);

        assertThat(response.originalName()).isEqualTo("my cv.pdf");

        String longName = "a".repeat(300) + ".pdf";
        MockMultipartFile tooLong = new MockMultipartFile("file", longName, "application/pdf",
                "%PDF-1.4".getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> attachmentService.upload(USER_ID, tooLong))
                .isInstanceOf(InvalidAttachmentException.class)
                .satisfies(ex -> assertThat(((InvalidAttachmentException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void listMarqueLeCvCourantEtConserveLOrdreDuRepository() {
        UUID currentId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        when(candidateService.getCurrentCvAttachmentId(USER_ID)).thenReturn(Optional.of(currentId));
        when(attachmentRepository.findByCandidateIdOrderByCreatedAtDescIdDesc(USER_ID))
                .thenReturn(List.of(attachment(currentId, "recent.pdf"), attachment(otherId, "old.pdf")));

        List<AttachmentResponse> responses = attachmentService.list(USER_ID);

        assertThat(responses).hasSize(2);
        assertThat(responses.get(0).id()).isEqualTo(currentId);
        assertThat(responses.get(0).current()).isTrue();
        assertThat(responses.get(1).id()).isEqualTo(otherId);
        assertThat(responses.get(1).current()).isFalse();
    }

    @Test
    void listSansCandidatNiPointeurResteVide() {
        when(candidateService.getCurrentCvAttachmentId(USER_ID)).thenReturn(Optional.empty());
        when(attachmentRepository.findByCandidateIdOrderByCreatedAtDescIdDesc(USER_ID)).thenReturn(List.of());

        assertThat(attachmentService.list(USER_ID)).isEmpty();
    }

    @Test
    void downloadRejetteUnCvDUnAutreCandidat() {
        UUID attachmentId = UUID.randomUUID();
        when(attachmentRepository.findByIdAndCandidateId(attachmentId, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> attachmentService.download(USER_ID, attachmentId))
                .isInstanceOf(AttachmentNotFoundException.class);
    }

    @Test
    void downloadRejetteUnFichierAbsentDuDisque() {
        UUID attachmentId = UUID.randomUUID();
        Attachment attachment = attachment(attachmentId, "cv.pdf");
        Resource missing = mock(Resource.class);
        when(missing.exists()).thenReturn(false);
        when(attachmentRepository.findByIdAndCandidateId(attachmentId, USER_ID))
                .thenReturn(Optional.of(attachment));
        when(attachmentStorage.load(attachment.getStoragePath())).thenReturn(missing);

        assertThatThrownBy(() -> attachmentService.download(USER_ID, attachmentId))
                .isInstanceOf(AttachmentNotFoundException.class);
    }

    @Test
    void downloadNominalRendLesMetadonneesEtLaRessource() {
        UUID attachmentId = UUID.randomUUID();
        Attachment attachment = attachment(attachmentId, "cv.pdf");
        Resource resource = mock(Resource.class);
        when(resource.exists()).thenReturn(true);
        when(attachmentRepository.findByIdAndCandidateId(attachmentId, USER_ID))
                .thenReturn(Optional.of(attachment));
        when(attachmentStorage.load(attachment.getStoragePath())).thenReturn(resource);
        when(candidateService.getCurrentCvAttachmentId(USER_ID)).thenReturn(Optional.of(attachmentId));

        AttachmentContent content = attachmentService.download(USER_ID, attachmentId);

        assertThat(content.attachment().id()).isEqualTo(attachmentId);
        assertThat(content.attachment().current()).isTrue();
        assertThat(content.resource()).isSameAs(resource);
    }

    @Test
    void switchRejetteUnCvInconnuEtDeduitLeCourantSinon() {
        UUID unknown = UUID.randomUUID();
        when(attachmentRepository.existsByIdAndCandidateId(unknown, USER_ID)).thenReturn(false);

        assertThatThrownBy(() -> attachmentService.setCurrent(USER_ID, unknown))
                .isInstanceOf(AttachmentNotFoundException.class);
        verify(candidateService, never()).setCurrentCvAttachment(any(), any());

        UUID known = UUID.randomUUID();
        when(attachmentRepository.existsByIdAndCandidateId(known, USER_ID)).thenReturn(true);

        attachmentService.setCurrent(USER_ID, known);

        verify(candidateService).setCurrentCvAttachment(USER_ID, known);
    }

    @Test
    void deleteSupprimeLaLignePuisLeFichier() {
        UUID attachmentId = UUID.randomUUID();
        Attachment attachment = attachment(attachmentId, "cv.pdf");
        when(attachmentRepository.findByIdAndCandidateId(attachmentId, USER_ID))
                .thenReturn(Optional.of(attachment));

        attachmentService.delete(USER_ID, attachmentId);

        InOrder order = inOrder(applicationRepository, attachmentRepository, attachmentStorage);
        // TD-054 : détaché des brouillons avant le DELETE (sinon la FK composite le rejetterait).
        order.verify(applicationRepository).detachCvFromDrafts(attachmentId, ApplicationStatus.DRAFT);
        order.verify(attachmentRepository).delete(attachment);
        order.verify(attachmentRepository).flush();
        order.verify(attachmentStorage).delete(attachment.getStoragePath());
    }

    @Test
    void deleteRefuseEn409UnCvJointAUneCandidatureTransmiseSansRienToucher() {
        UUID attachmentId = UUID.randomUUID();
        when(attachmentRepository.findByIdAndCandidateId(attachmentId, USER_ID))
                .thenReturn(Optional.of(attachment(attachmentId, "cv.pdf")));
        when(applicationRepository.existsByCvAttachmentIdAndStatusNot(attachmentId, ApplicationStatus.DRAFT))
                .thenReturn(true);

        assertThatThrownBy(() -> attachmentService.delete(USER_ID, attachmentId))
                .isInstanceOfSatisfying(InvalidAttachmentException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(ex.getMessage())
                            .isEqualTo("This CV is attached to an application you sent and cannot be deleted.");
                });

        verify(applicationRepository, never()).detachCvFromDrafts(any(), any());
        verify(attachmentRepository, never()).delete(any());
        verifyNoInteractions(attachmentStorage);
    }

    @Test
    void deleteRejetteUnCvInconnuSansToucherAuDisque() {
        UUID unknown = UUID.randomUUID();
        when(attachmentRepository.findByIdAndCandidateId(unknown, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> attachmentService.delete(USER_ID, unknown))
                .isInstanceOf(AttachmentNotFoundException.class);

        verifyNoInteractions(attachmentStorage);
    }

    private static MockMultipartFile pdf(String fileName) {
        return new MockMultipartFile("file", fileName, "application/pdf",
                "%PDF-1.4 fake".getBytes(StandardCharsets.UTF_8));
    }

    private static Attachment attachment(UUID id, String name) {
        return Attachment.builder()
                .id(id)
                .candidateId(USER_ID)
                .originalName(name)
                .mimeType("application/pdf")
                .sizeBytes(14L)
                .sha256("ab".repeat(32))
                .storagePath("candidates/" + USER_ID + "/" + id)
                .createdAt(LocalDateTime.now())
                .build();
    }
}

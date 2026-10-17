package com.linqorbit.attachment.controller;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.linqorbit.attachment.dto.AttachmentContent;
import com.linqorbit.attachment.dto.AttachmentResponse;
import com.linqorbit.attachment.service.AttachmentService;
import com.linqorbit.common.security.CurrentUserId;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/candidates")
@RequiredArgsConstructor
public class AttachmentController implements AttachmentApi {

    private final AttachmentService attachmentService;

    @Override
    public ResponseEntity<AttachmentResponse> upload(MultipartFile file, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(attachmentService.upload(CurrentUserId.from(authentication), file));
    }

    @Override
    public ResponseEntity<List<AttachmentResponse>> list(Authentication authentication) {
        return ResponseEntity.ok(attachmentService.list(CurrentUserId.from(authentication)));
    }

    @Override
    public ResponseEntity<Resource> download(UUID attachmentId, Authentication authentication) {
        AttachmentContent content = attachmentService.download(CurrentUserId.from(authentication), attachmentId);
        AttachmentResponse meta = content.attachment();
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(meta.originalName(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(meta.mimeType()))
                .contentLength(meta.sizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(content.resource());
    }

    @Override
    public ResponseEntity<Void> setCurrent(UUID attachmentId, Authentication authentication) {
        attachmentService.setCurrent(CurrentUserId.from(authentication), attachmentId);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> delete(UUID attachmentId, Authentication authentication) {
        attachmentService.delete(CurrentUserId.from(authentication), attachmentId);
        return ResponseEntity.noContent().build();
    }
}

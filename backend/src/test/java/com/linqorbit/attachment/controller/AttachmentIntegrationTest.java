package com.linqorbit.attachment.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Parcours HTTP réels des pièces jointes (PostgreSQL + stockage disque réels) :
 * upload, historique, bascule du CV courant, téléchargement, suppression et
 * contrôle propriétaire. Le dépôt du premier CV crée la ligne candidates ;
 * le pointeur bulk ne touche jamais updated_at (dirty-flag du profil).
 */
@SpringBootTest
@AutoConfigureMockMvc
class AttachmentIntegrationTest {

    private static final String ATTACHMENTS_PATH = "/api/v1/candidates/me/attachments";
    private static final byte[] PDF_BYTES = "%PDF-1.4 fake CV content".getBytes(StandardCharsets.UTF_8);

    private static final Path STORAGE_ROOT = createStorageRoot();

    @DynamicPropertySource
    static void storageRoot(DynamicPropertyRegistry registry) {
        registry.add("app.attachments.storage-root", () -> STORAGE_ROOT.toString());
    }

    private static Path createStorageRoot() {
        try {
            return Files.createTempDirectory("linqorbit-attachments-it");
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final List<UUID> createdUserIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (UUID userId : createdUserIds) {
            jdbcTemplate.update("DELETE FROM candidates WHERE id = ?", userId);
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
        createdUserIds.clear();
    }

    @Test
    void depotPuisListePuisTelechargement() throws Exception {
        String token = signup();
        UUID userId = lastCreatedUserId();

        UUID attachmentId = upload(token, "cv.pdf", PDF_BYTES);

        assertThat(countAttachments(userId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT current_cv_attachment_id::text FROM candidates WHERE id = ?", String.class, userId))
                .isEqualTo(attachmentId.toString());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT storage_path FROM attachment WHERE id = ?", String.class, attachmentId))
                .isEqualTo("candidates/" + userId + "/" + attachmentId);
        Path stored = STORAGE_ROOT.resolve("candidates/" + userId + "/" + attachmentId);
        assertThat(Files.readAllBytes(stored)).isEqualTo(PDF_BYTES);

        mockMvc.perform(get(ATTACHMENTS_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(attachmentId.toString()))
                .andExpect(jsonPath("$[0].originalName").value("cv.pdf"))
                .andExpect(jsonPath("$[0].mimeType").value("application/pdf"))
                .andExpect(jsonPath("$[0].sizeBytes").value(PDF_BYTES.length))
                .andExpect(jsonPath("$[0].sha256").value(sha256Hex(PDF_BYTES)))
                .andExpect(jsonPath("$[0].current").value(true));

        MvcResult download = mockMvc.perform(get(ATTACHMENTS_PATH + "/" + attachmentId + "/content")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(download.getResponse().getContentAsByteArray()).isEqualTo(PDF_BYTES);
        assertThat(download.getResponse().getContentType()).isEqualTo("application/pdf");
        assertThat(download.getResponse().getHeader("Content-Disposition")).contains("cv.pdf");
    }

    @Test
    void remplacementConserveLesAnciensEtLaBasculeNeSalitPasLeProfil() throws Exception {
        String token = signup();
        UUID userId = lastCreatedUserId();

        UUID firstId = upload(token, "first.pdf", "%PDF-1.4 first".getBytes(StandardCharsets.UTF_8));
        String updatedAtAfterFirst = updatedAt(userId);

        UUID secondId = upload(token, "second.pdf", "%PDF-1.4 second".getBytes(StandardCharsets.UTF_8));

        // Le dépôt suivant et la bascule passent par un UPDATE bulk : updated_at
        // du profil ne bouge pas (le dirty-flag ne doit pas s'allumer).
        assertThat(updatedAt(userId)).isEqualTo(updatedAtAfterFirst);

        mockMvc.perform(get(ATTACHMENTS_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(secondId.toString()))
                .andExpect(jsonPath("$[0].current").value(true))
                .andExpect(jsonPath("$[1].id").value(firstId.toString()))
                .andExpect(jsonPath("$[1].current").value(false));

        mockMvc.perform(put(ATTACHMENTS_PATH + "/" + firstId + "/current")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        assertThat(updatedAt(userId)).isEqualTo(updatedAtAfterFirst);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT current_cv_attachment_id::text FROM candidates WHERE id = ?", String.class, userId))
                .isEqualTo(firstId.toString());

        mockMvc.perform(get(ATTACHMENTS_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(secondId.toString()))
                .andExpect(jsonPath("$[0].current").value(false))
                .andExpect(jsonPath("$[1].id").value(firstId.toString()))
                .andExpect(jsonPath("$[1].current").value(true));

        // Les deux restent téléchargeables après la bascule.
        mockMvc.perform(get(ATTACHMENTS_PATH + "/" + firstId + "/content")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mockMvc.perform(get(ATTACHMENTS_PATH + "/" + secondId + "/content")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void suppressionEffaceLigneFichierEtPointeur() throws Exception {
        String token = signup();
        UUID userId = lastCreatedUserId();
        UUID attachmentId = upload(token, "cv.pdf", PDF_BYTES);
        Path stored = STORAGE_ROOT.resolve("candidates/" + userId + "/" + attachmentId);

        mockMvc.perform(delete(ATTACHMENTS_PATH + "/" + attachmentId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        assertThat(countAttachments(userId)).isZero();
        assertThat(stored).doesNotExist();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT current_cv_attachment_id::text FROM candidates WHERE id = ?", String.class, userId))
                .isNull();

        mockMvc.perform(get(ATTACHMENTS_PATH + "/" + attachmentId + "/content")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete(ATTACHMENTS_PATH + "/" + attachmentId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void suppressionDuCompteEmporteLesPiecesJointes() throws Exception {
        String token = signup();
        UUID userId = lastCreatedUserId();
        upload(token, "cv.pdf", PDF_BYTES);

        jdbcTemplate.update("DELETE FROM candidates WHERE id = ?", userId);

        assertThat(countAttachments(userId)).isZero();
    }

    @Test
    void validationsDuDepot() throws Exception {
        String token = signup();

        mockMvc.perform(multipart(ATTACHMENTS_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());

        mockMvc.perform(multipart(ATTACHMENTS_PATH)
                        .file(new MockMultipartFile("file", "cv.pdf", "application/pdf", new byte[0]))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("No file uploaded."));

        mockMvc.perform(multipart(ATTACHMENTS_PATH)
                        .file(new MockMultipartFile("file", "cv.docx", "application/msword",
                                "data".getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.detail").value("Only PDF files are supported."));
    }

    @Test
    void leNomDeFichierAvecCheminEstReduitAuBasename() throws Exception {
        String token = signup();

        mockMvc.perform(multipart(ATTACHMENTS_PATH)
                        .file(new MockMultipartFile("file", "C:\\Users\\me\\my cv.pdf", "application/pdf",
                                PDF_BYTES))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.originalName").value("my cv.pdf"));
    }

    @Test
    void ressourceDAutruiEstIntrouvableEtListeDAutruiResteVide() throws Exception {
        String tokenA = signup();
        UUID attachmentIdA = upload(tokenA, "cv.pdf", PDF_BYTES);

        String tokenB = signup();

        mockMvc.perform(get(ATTACHMENTS_PATH).header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get(ATTACHMENTS_PATH + "/" + attachmentIdA + "/content")
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isNotFound());
        mockMvc.perform(put(ATTACHMENTS_PATH + "/" + attachmentIdA + "/current")
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete(ATTACHMENTS_PATH + "/" + attachmentIdA)
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isNotFound());

        // Le propriétaire garde son CV intact.
        mockMvc.perform(get(ATTACHMENTS_PATH).header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void listeVideSansCvEtSansProfilCandidat() throws Exception {
        String token = signup();
        UUID userId = lastCreatedUserId();

        mockMvc.perform(get(ATTACHMENTS_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        assertThat(countCandidates(userId)).isZero();
    }

    @Test
    void identifiantNonUuidEtRequetesSansJeton() throws Exception {
        String token = signup();
        UUID attachmentId = upload(token, "cv.pdf", PDF_BYTES);

        mockMvc.perform(get(ATTACHMENTS_PATH + "/not-a-uuid/content")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(ATTACHMENTS_PATH)).andExpect(status().isUnauthorized());
        mockMvc.perform(multipart(ATTACHMENTS_PATH)
                        .file(new MockMultipartFile("file", "cv.pdf", "application/pdf", PDF_BYTES)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get(ATTACHMENTS_PATH + "/" + attachmentId + "/content"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(put(ATTACHMENTS_PATH + "/" + attachmentId + "/current"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete(ATTACHMENTS_PATH + "/" + attachmentId)).andExpect(status().isUnauthorized());
    }

    private UUID upload(String token, String fileName, byte[] content) throws Exception {
        MvcResult result = mockMvc.perform(multipart(ATTACHMENTS_PATH)
                        .file(new MockMultipartFile("file", fileName, "application/pdf", content))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return UUID.fromString(body.get("id").asText());
    }

    private String updatedAt(UUID userId) {
        return jdbcTemplate.queryForObject("SELECT updated_at::text FROM candidates WHERE id = ?", String.class,
                userId);
    }

    private int countAttachments(UUID userId) {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM attachment WHERE candidate_id = ?", Integer.class,
                userId);
    }

    private int countCandidates(UUID userId) {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM candidates WHERE id = ?", Integer.class, userId);
    }

    private static String sha256Hex(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private String signup() throws Exception {
        String email = "candidate-" + UUID.randomUUID() + "@example.com";
        MvcResult result = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "secret123",
                                  "firstName": "Ada",
                                  "lastName": "Lovelace",
                                  "phone": "+1 555 000 0000",
                                  "sex": "female",
                                  "homeCountry": "FR",
                                  "currentCity": "Paris",
                                  "currentCountry": "FR"
                                }
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        createdUserIds.add(UUID.fromString(body.get("user").get("id").asText()));
        return body.get("token").asText();
    }

    private UUID lastCreatedUserId() {
        return createdUserIds.get(createdUserIds.size() - 1);
    }
}

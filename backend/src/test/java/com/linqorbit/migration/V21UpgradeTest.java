package com.linqorbit.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * V21 n'est pas une simple création de tables : elle renumérote les statuts de
 * {@code application}. Le commentaire de la migration suppose une base vide —
 * ce test prouve le contraire sur une base V20 réelle, avec des lignes
 * existantes dans chaque ancien statut (1–4 → 2–5), sans modifier V21 ni les
 * données de production.
 *
 * <p>Un schéma PostgreSQL dédié est créé pour l'occasion : la suite complète
 * reste sur le schéma public et aucune migration déjà appliquée n'est rejouée
 * sur les données partagées.</p>
 */
@SpringBootTest
class V21UpgradeTest {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void upgradeV20AvecCandidaturesExistantesDecaleLesStatutsSansPerte() {
        String schema = "v21_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        jdbcTemplate.execute("CREATE SCHEMA " + schema);
        try {
            flyway(schema, "20").migrate();

            UUID recruiterId = insertUser(schema, "recruiter@v21.test");
            insertRecruiter(schema, recruiterId);
            UUID companyId = UUID.randomUUID();
            jdbcTemplate.update("""
                    INSERT INTO %s.companies (id, name, created_at, updated_at)
                    VALUES (?, 'V21 Corp', ?, ?)""".formatted(schema),
                    companyId, LocalDateTime.now(), LocalDateTime.now());
            UUID offerId = UUID.randomUUID();
            jdbcTemplate.update("""
                    INSERT INTO %s.job_offer
                        (id, public_id, slug, company_id, recruiter_id, status, title, created_at, updated_at)
                    VALUES (?, ?, 'backend-engineer', ?, ?, 1, 'Backend Engineer', ?, ?)""".formatted(schema),
                    offerId, offerId.toString().replace("-", "").substring(0, 12), companyId, recruiterId,
                    LocalDateTime.now(), LocalDateTime.now());

            List<UUID> candidateIds = List.of(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                    UUID.randomUUID());
            for (int i = 0; i < candidateIds.size(); i++) {
                UUID candidateId = candidateIds.get(i);
                insertUser(schema, "candidate" + i + "@v21.test", candidateId);
                jdbcTemplate.update("""
                        INSERT INTO %s.candidates (id, created_at, updated_at) VALUES (?, ?, ?)""".formatted(schema),
                        candidateId, LocalDateTime.now(), LocalDateTime.now());
                UUID attachmentId = UUID.randomUUID();
                jdbcTemplate.update("""
                        INSERT INTO %s.attachment
                            (id, candidate_id, original_name, mime_type, size_bytes, sha256, storage_path, created_at)
                        VALUES (?, ?, 'cv.pdf', 'application/pdf', 12, 'sha', '/tmp/cv.pdf', ?)""".formatted(schema),
                        attachmentId, candidateId, LocalDateTime.now());
                jdbcTemplate.update("""
                        INSERT INTO %s.application
                            (id, candidate_id, job_offer_id, cv_attachment_id, status, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)""".formatted(schema),
                        UUID.randomUUID(), candidateId, offerId, attachmentId, (short) (i + 1),
                        LocalDateTime.now(), LocalDateTime.now());
            }

            flyway(schema, null).migrate();

            for (int i = 0; i < candidateIds.size(); i++) {
                assertThat(jdbcTemplate.queryForObject(
                        "SELECT status FROM " + schema + ".application WHERE candidate_id = ?",
                        Short.class, candidateIds.get(i))).isEqualTo((short) (i + 2));
            }
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM " + schema + ".application", Integer.class)).isEqualTo(4);
            assertThat(jdbcTemplate.queryForObject("""
                    SELECT COUNT(*) FROM pg_constraint
                    WHERE conname = 'fk_application_matching'
                      AND conrelid = (? || '.application')::regclass""", Integer.class, schema)).isEqualTo(1);
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "UPDATE " + schema + ".application SET status = 6 WHERE candidate_id = ?",
                    candidateIds.get(0)))
                    .isInstanceOf(DataIntegrityViolationException.class);
        } finally {
            jdbcTemplate.execute("DROP SCHEMA " + schema + " CASCADE");
        }
    }

    private Flyway flyway(String schema, String target) {
        var configuration = Flyway.configure()
                .dataSource(dataSource)
                .schemas(schema)
                .defaultSchema(schema)
                .locations("classpath:db/migration")
                .createSchemas(true)
                .cleanDisabled(false);
        if (target != null) {
            configuration.target(target);
        }
        return configuration.load();
    }

    private UUID insertUser(String schema, String email) {
        UUID id = UUID.randomUUID();
        insertUser(schema, email, id);
        return id;
    }

    private void insertUser(String schema, String email, UUID id) {
        jdbcTemplate.update("""
                INSERT INTO %s.users (id, email, password_hash, first_name, last_name, status, created_at, updated_at)
                VALUES (?, ?, 'x', 'Test', 'User', 1, ?, ?)""".formatted(schema),
                id, email, LocalDateTime.now(), LocalDateTime.now());
    }

    private void insertRecruiter(String schema, UUID id) {
        jdbcTemplate.update("""
                INSERT INTO %s.recruiters (id, created_at, updated_at) VALUES (?, ?, ?)""".formatted(schema),
                id, LocalDateTime.now(), LocalDateTime.now());
    }
}

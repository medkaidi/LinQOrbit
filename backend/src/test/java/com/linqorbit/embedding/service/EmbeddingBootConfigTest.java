package com.linqorbit.embedding.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.PropertiesPropertySourceLoader;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

/**
 * Interrupteurs de démarrage de l'embedding : la production reprend ses jobs orphelins par défaut, jamais le
 * backfill ; les tests ne reprennent rien (la base de dev est partagée, aucune ligne réelle ne doit bouger).
 * Lecture des deux fichiers de configuration tels quels — sans démarrer de contexte.
 */
class EmbeddingBootConfigTest {

    private static Object yml(String key) throws IOException {
        List<PropertySource<?>> sources = new YamlPropertySourceLoader()
                .load("application", new ClassPathResource("application.yml"));
        return sources.get(0).getProperty(key);
    }

    @Test
    void productionRecoversOrphanJobsAtBootByDefault() throws IOException {
        assertThat(yml("app.embedding.recovery-on-boot")).isEqualTo("${EMBEDDING_RECOVERY_ON_BOOT:true}");
    }

    @Test
    void productionNeverBackfillsAtBootByDefault() throws IOException {
        assertThat(yml("app.embedding.backfill-on-boot")).isEqualTo("${EMBEDDING_BACKFILL_ON_BOOT:false}");
    }

    @Test
    void testContextsDoNotRecoverAnythingAtBoot() throws IOException {
        List<PropertySource<?>> sources = new PropertiesPropertySourceLoader()
                .load("test", new ClassPathResource("application.properties"));

        assertThat(sources.get(0).getProperty("app.embedding.recovery-on-boot")).isEqualTo("false");
    }
}

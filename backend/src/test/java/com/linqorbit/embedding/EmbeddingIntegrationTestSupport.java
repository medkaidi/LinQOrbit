package com.linqorbit.embedding;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import com.linqorbit.embedding.client.EmbedClient;
import com.linqorbit.screening.service.ScreeningService;

/**
 * Contexte Spring <b>unique</b> des tests d'intégration embedding et screening.
 *
 * <p>Chaque combinaison distincte de propriétés et de {@code @MockitoBean} crée un
 * contexte mis en cache pour toute la JVM de test : les deux classes partagent donc
 * exactement la même configuration — un seul contexte — même si le client IA n'est
 * pas utilisé par les tests de screening. (La marge de connexions de la base de dev
 * partagée est étroite : le pool de test est plafonné dans
 * {@code src/test/resources/application.properties}.)</p>
 *
 * <p>Modèle de test dédié ({@link EmbeddingTestData#TEST_MODEL}) : tout job ou
 * vecteur créé ici est étiqueté à part et balayé, jamais confondu avec une donnée
 * réelle. Pools inertes : aucune exécution asynchrone ne part vers le service IA.</p>
 */
@AutoConfigureMockMvc
@SpringBootTest(properties = {
        "app.embedding.model-name=" + EmbeddingTestData.TEST_MODEL,
        "app.embedding.min-interval-ms=0"})
public abstract class EmbeddingIntegrationTestSupport {

    @Autowired
    protected JdbcTemplate jdbc;

    @MockitoBean
    protected EmbedClient embedClient;
    @MockitoBean(name = "embeddingExecutor")
    protected ThreadPoolTaskExecutor embeddingExecutor;
    @MockitoBean(name = "embeddingTaskScheduler")
    protected TaskScheduler embeddingTaskScheduler;
    // T-101 : pools du screening inertes aussi, le worker est piloté à la main par les tests.
    @MockitoBean(name = "screeningExecutor")
    protected ThreadPoolTaskExecutor screeningExecutor;
    @MockitoBean(name = "screeningTaskScheduler")
    protected TaskScheduler screeningTaskScheduler;
    // Espion : permet de simuler une panne du Top N (échecs et relance du job de recherche).
    @MockitoSpyBean
    protected ScreeningService screeningServiceSpy;
}

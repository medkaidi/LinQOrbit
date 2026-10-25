package com.linqorbit.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

/**
 * Pool de travail de la génération d'embeddings, miroir de
 * {@link NormalizationExecutorConfig} : exécution <b>poussée</b> (fin de
 * normalisation → exécuteur), retries en one-shot sur un scheduler dédié,
 * aucun {@code @Scheduled}. Un seul thread par défaut : le débit vers le
 * fournisseur (quota du palier gratuit) est borné par le pool et par
 * {@code app.embedding.min-interval-ms}.
 */
@Configuration
public class EmbeddingExecutorConfig {

    @Bean
    ThreadPoolTaskExecutor embeddingExecutor(@Value("${app.embedding.threads}") int threads) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(threads);
        executor.setMaxPoolSize(threads);
        executor.setQueueCapacity(1024);
        executor.setThreadNamePrefix("embedding-");
        executor.initialize();
        return executor;
    }

    @Bean
    TaskScheduler embeddingTaskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("embedding-retry-");
        scheduler.initialize();
        return scheduler;
    }
}

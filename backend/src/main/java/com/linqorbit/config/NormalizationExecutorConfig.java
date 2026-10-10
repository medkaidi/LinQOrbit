package com.linqorbit.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

/**
 * Pool de travail de la normalisation de profil. Deux beans dédiés, aucun
 * {@code @Scheduled} : l'exécution est <b>poussée</b> (événement de validation
 * après commit → exécuteur) et les retries sont des <b>one-shot</b> sur le
 * scheduler (échéance {@code next_attempt_at}), jamais un scan périodique.
 *
 * <p>L'exécuteur est borné (queue 256) : un rejet est donc un état réel,
 * géré par le worker (re-soumission planifiée). Le scheduler est non borné
 * côté file — le dernier filet de reprise d'un job reste le recovery au
 * démarrage.</p>
 */
@Configuration
public class NormalizationExecutorConfig {

    @Bean
    ThreadPoolTaskExecutor normalizationExecutor(@Value("${app.normalization.threads}") int threads) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(threads);
        executor.setMaxPoolSize(threads);
        executor.setQueueCapacity(256);
        executor.setThreadNamePrefix("normalization-");
        executor.initialize();
        return executor;
    }

    @Bean
    TaskScheduler normalizationTaskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("normalization-retry-");
        scheduler.initialize();
        return scheduler;
    }
}

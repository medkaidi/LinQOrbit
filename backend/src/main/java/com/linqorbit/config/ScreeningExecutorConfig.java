package com.linqorbit.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

/**
 * Pool de travail du screening automatique des offres publiées (T-101),
 * miroir de {@link EmbeddingExecutorConfig} : exécution <b>poussée</b>
 * (publication ou fin d'embedding de l'offre → exécuteur), retries en
 * one-shot sur un scheduler dédié, aucun {@code @Scheduled}. Pool séparé de
 * celui des embeddings : le Top N est une requête SQL locale, il ne doit pas
 * attendre la temporisation du fournisseur d'embeddings.
 */
@Configuration
public class ScreeningExecutorConfig {

    @Bean
    ThreadPoolTaskExecutor screeningExecutor(@Value("${app.screening.threads:1}") int threads) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(threads);
        executor.setMaxPoolSize(threads);
        executor.setQueueCapacity(256);
        executor.setThreadNamePrefix("screening-");
        executor.initialize();
        return executor;
    }

    @Bean
    TaskScheduler screeningTaskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("screening-retry-");
        scheduler.initialize();
        return scheduler;
    }
}

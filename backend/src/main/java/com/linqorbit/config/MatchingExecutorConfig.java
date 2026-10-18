package com.linqorbit.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

/**
 * Pool de travail du matching (D51), miroir de {@link NormalizationExecutorConfig}
 * : deux beans dédiés, aucun {@code @Scheduled} — l'exécution est poussée
 * (événement de lancement après commit → exécuteur) et les retries sont des
 * one-shot sur le scheduler. Pool séparé de la normalisation : une rafale de
 * matchings ne retarde jamais une validation de profil ou d'offre.
 */
@Configuration
public class MatchingExecutorConfig {

    @Bean
    ThreadPoolTaskExecutor matchingExecutor(@Value("${app.matching.threads}") int threads) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(threads);
        executor.setMaxPoolSize(threads);
        executor.setQueueCapacity(256);
        executor.setThreadNamePrefix("matching-");
        executor.initialize();
        return executor;
    }

    @Bean
    TaskScheduler matchingTaskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("matching-retry-");
        scheduler.initialize();
        return scheduler;
    }
}

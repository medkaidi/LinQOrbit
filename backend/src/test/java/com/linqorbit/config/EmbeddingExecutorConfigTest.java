package com.linqorbit.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

/**
 * Câblage des pools d'embedding : un pool dédié, borné, nommé (les threads se
 * repèrent dans les logs) et un scheduler à un thread pour les retries one-shot.
 */
class EmbeddingExecutorConfigTest {

    private final EmbeddingExecutorConfig config = new EmbeddingExecutorConfig();

    @Test
    void theExecutorHasTheConfiguredSizeABoundedQueueAndANamedThread() throws Exception {
        ThreadPoolTaskExecutor executor = config.embeddingExecutor(3);
        try {
            assertThat(executor.getCorePoolSize()).isEqualTo(3);
            assertThat(executor.getMaxPoolSize()).isEqualTo(3);
            assertThat(executor.getThreadNamePrefix()).isEqualTo("embedding-");
            assertThat(executor.getThreadPoolExecutor().getQueue().remainingCapacity()).isEqualTo(1024);

            String name = executor.submit(() -> Thread.currentThread().getName()).get();
            assertThat(name).startsWith("embedding-");
        } finally {
            executor.shutdown();
        }
    }

    @Test
    void theDefaultSingleThreadKeepsTheProviderThroughputBounded() {
        ThreadPoolTaskExecutor executor = config.embeddingExecutor(1);
        try {
            assertThat(executor.getCorePoolSize()).isEqualTo(1);
            assertThat(executor.getMaxPoolSize()).isEqualTo(1);
        } finally {
            executor.shutdown();
        }
    }

    @Test
    void theRetrySchedulerIsDistinctFromTheExecutorAndRunsOnOneNamedThread() throws Exception {
        ThreadPoolTaskScheduler scheduler = (ThreadPoolTaskScheduler) config.embeddingTaskScheduler();
        try {
            assertThat(scheduler.getThreadNamePrefix()).isEqualTo("embedding-retry-");
            assertThat(scheduler.getScheduledThreadPoolExecutor().getCorePoolSize()).isEqualTo(1);

            String name = scheduler.submit(() -> Thread.currentThread().getName()).get();
            assertThat(name).startsWith("embedding-retry-");
        } finally {
            scheduler.shutdown();
        }
    }
}

package com.sortify.backendcore;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

import java.util.TimeZone;

@SpringBootApplication(scanBasePackages = "com.sortify")
@EntityScan(basePackages = "com.sortify")
@EnableJpaRepositories(basePackages = "com.sortify")
public class BackendCoreApplication {

    static {
        // PostgreSQL accepts Asia/Kolkata/UTC, but not the legacy Asia/Calcutta ID.
        // Normalize the JVM timezone before any datasource connection is created.
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    }

    public static void main(String[] args) {
        SpringApplication.run(BackendCoreApplication.class, args);
    }

}

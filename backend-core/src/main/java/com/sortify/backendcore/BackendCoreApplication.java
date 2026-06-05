package com.sortify.backendcore;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.TimeZone;

@SpringBootApplication
public class BackendCoreApplication {

    public static void main(String[] args) {
        // System.out.println("JVM TZ = " + TimeZone.getDefault().getID());
        SpringApplication.run(BackendCoreApplication.class, args);
    }

}

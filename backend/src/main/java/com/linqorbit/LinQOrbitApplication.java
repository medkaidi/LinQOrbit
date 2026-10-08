package com.linqorbit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class LinQOrbitApplication {

	public static void main(String[] args) {
		SpringApplication.run(LinQOrbitApplication.class, args);
	}

}

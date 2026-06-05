package com.sortify.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank(message = "Email is required!")
        @Email(message = "Invalid email format")
        String email,

        @NotBlank(message = "Password is required!")
        @Size(min = 8, message = "Password must contain at least 8 characters")
        String password
) {
}

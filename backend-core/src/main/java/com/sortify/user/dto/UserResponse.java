package com.sortify.user.dto;

import com.sortify.common.Role;

public record UserResponse(
        Long id,
        String email,
        Role role
) {
}

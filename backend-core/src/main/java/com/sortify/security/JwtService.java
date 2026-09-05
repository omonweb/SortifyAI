package com.sortify.security;

import com.sortify.user.entity.User;

public interface JwtService {

    String generateToken(User user);

    String extractUsername(String token);

    boolean isTokenValid(String token, User user);

    boolean isTokenExpired(String token);
}

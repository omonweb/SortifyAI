package com.sortify.user.service;

import com.sortify.user.dto.AuthResponse;
import com.sortify.user.dto.SignupRequest;
import com.sortify.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;

    @Override
    public AuthResponse signup(SignupRequest request) {

        throw new UnsupportedOperationException(
                "Signup implementation will be added after JWT and Password Encoder config"
        );
    }
}

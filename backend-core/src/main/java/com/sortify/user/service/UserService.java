package com.sortify.user.service;

import com.sortify.user.dto.AuthResponse;
import com.sortify.user.dto.SignupRequest;

public interface UserService {

    AuthResponse signup(SignupRequest request);
}

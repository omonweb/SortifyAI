package com.sortify.user.dto;

public record AuthResponse(
        String accessToken,
        UserResponse user
) {
}

//     {
//        "accessToken":"xyz",
//        "user":{
//        "id":1,
//        "email":"om@gmail.com",
//        "role":"RECRUITER"
//        }
//     }
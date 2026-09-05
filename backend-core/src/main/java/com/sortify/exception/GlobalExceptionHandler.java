package com.sortify.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ResponseEntity<ErrorResponse> handleEmailAlreadyExistsException(

            EmailAlreadyExistsException exception,

            HttpServletRequest request
    ) {

        ErrorResponse errorResponse = new ErrorResponse(

                Instant.now(),

                HttpStatus.CONFLICT.value(),

                HttpStatus.CONFLICT.getReasonPhrase(),

                exception.getMessage(),

                request.getRequestURI()
        );

        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(errorResponse);
    }
}

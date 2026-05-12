package com.ayaan.dealora.data.auth

import com.ayaan.dealora.data.api.models.User

sealed class AuthResult {
    data object OtpSent : AuthResult()
    data class Success(val user: User) : AuthResult()
    data class Error(val message: String, val throwable: Throwable? = null) : AuthResult()
}


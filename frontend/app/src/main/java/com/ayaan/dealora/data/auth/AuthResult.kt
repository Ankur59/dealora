package com.ayaan.dealora.data.auth

sealed class AuthResult {
    data object OtpSent : AuthResult()
    data object Success : AuthResult()
    data class Error(val message: String, val throwable: Throwable? = null) : AuthResult()
}


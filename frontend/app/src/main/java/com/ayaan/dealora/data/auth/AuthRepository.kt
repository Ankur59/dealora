package com.ayaan.dealora.data.auth

import android.app.Activity

interface AuthRepository {
    suspend fun sendOtp(
        phoneNumber: String,
        activity: Activity,
        isLogin: Boolean = true
    ): AuthResult

    suspend fun verifyOtp(
        verificationId: String,
        otpCode: String,
        isLogin: Boolean,
        name: String? = null,
        email: String? = null,
        phoneNumber: String? = null
    ): AuthResult
}


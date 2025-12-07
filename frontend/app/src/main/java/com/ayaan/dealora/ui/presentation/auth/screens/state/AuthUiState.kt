package com.ayaan.dealora.ui.presentation.auth.screens.state

data class AuthUiState(
    val isLoading: Boolean = false,
    val isOtpSent: Boolean = false,
    val isOtpVerifying: Boolean = false,
    val verificationId: String? = null,
    val otpTimeRemainingSec: Int = 0,
    val errorMessage: String? = null,
    val isSuccess: Boolean = false
)
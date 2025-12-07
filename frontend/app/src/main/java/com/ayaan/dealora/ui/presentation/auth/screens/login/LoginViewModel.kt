package com.ayaan.dealora.ui.presentation.auth.screens.login

import android.app.Activity
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.auth.AuthRepository
import com.ayaan.dealora.data.auth.AuthResult
import com.ayaan.dealora.data.auth.FirebaseAuthRepository
import com.ayaan.dealora.ui.presentation.auth.screens.state.AuthUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    companion object {
        private const val TAG = "LoginViewModel"
    }

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private var _phoneNumber = MutableStateFlow("")
    val phoneNumber: StateFlow<String> = _phoneNumber.asStateFlow()

    private var _otp = MutableStateFlow("")
    val otp: StateFlow<String> = _otp.asStateFlow()

    private var timerJob: Job? = null

    fun onPhoneNumberChanged(newPhone: String) {
        if (newPhone.length <= 10) {
            _phoneNumber.value = newPhone
        }
    }

    fun onOtpChanged(newOtp: String) {
        _otp.value = newOtp
    }

    fun sendOtp(activity: Activity) {
        val phone = _phoneNumber.value

        // Basic validation
        if (phone.length != 10) {
            _uiState.update { it.copy(errorMessage = "Please enter a valid 10-digit phone number") }
            return
        }

        _uiState.update { it.copy(isLoading = true, errorMessage = null) }

        viewModelScope.launch {
            val fullPhoneNumber = "+91$phone"
            when (val result = authRepository.sendOtp(fullPhoneNumber, activity, isLogin = true)) {
                is AuthResult.OtpSent -> {
                    Log.d(TAG, "OTP sent successfully to $fullPhoneNumber")
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isOtpSent = true,
                            otpTimeRemainingSec = FirebaseAuthRepository.Companion.OTP_TIMEOUT_SECONDS.toInt()
                        )
                    }
                    startOtpTimer()
                }
                is AuthResult.Error -> {
                    Log.e(TAG, "Failed to send OTP: ${result.message}", result.throwable)
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = result.message
                        )
                    }
                }
                else -> {
                    Log.e(TAG, "Unexpected result: $result")
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = "Something went wrong. Please try again."
                        )
                    }
                }
            }
        }
    }

    fun verifyOtp() {
        val verificationId = FirebaseAuthRepository.Companion.currentVerificationId
        val otpCode = _otp.value

        if (verificationId == null) {
            _uiState.update { it.copy(errorMessage = "Verification ID is missing. Please resend OTP.") }
            return
        }

        if (otpCode.length != 6) {
            _uiState.update { it.copy(errorMessage = "Please enter the complete 6-digit OTP") }
            return
        }

        _uiState.update { it.copy(isOtpVerifying = true, errorMessage = null) }

        viewModelScope.launch {
            when (val result = authRepository.verifyOtp(
                verificationId = verificationId,
                otpCode = otpCode,
                isLogin = true
            )) {
                is AuthResult.Success -> {
                    Log.d(TAG, "OTP verified successfully, user: ${result.user.name}")
                    _uiState.update {
                        it.copy(
                            isOtpVerifying = false,
                            isSuccess = true
                        )
                    }
                    timerJob?.cancel()
                }
                is AuthResult.Error -> {
                    Log.e(TAG, "Failed to verify OTP: ${result.message}", result.throwable)
                    _uiState.update {
                        it.copy(
                            isOtpVerifying = false,
                            errorMessage = result.message
                        )
                    }
                }
                else -> {
                    Log.e(TAG, "Unexpected result: $result")
                    _uiState.update {
                        it.copy(
                            isOtpVerifying = false,
                            errorMessage = "Something went wrong. Please try again."
                        )
                    }
                }
            }
        }
    }

    fun resendOtp(activity: Activity) {
        if (_uiState.value.otpTimeRemainingSec > 0) {
            return // Timer still running
        }
        _otp.value = "" // Clear OTP field
        sendOtp(activity)
    }

    fun consumeError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun consumeSuccess() {
        _uiState.update { it.copy(isSuccess = false) }
    }

    private fun startOtpTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (_uiState.value.otpTimeRemainingSec > 0) {
                delay(1000L)
                _uiState.update { it.copy(otpTimeRemainingSec = it.otpTimeRemainingSec - 1) }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        timerJob?.cancel()
    }
}
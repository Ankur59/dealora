package com.ayaan.dealora.data.auth

import android.app.Activity
import android.util.Log
import com.google.firebase.FirebaseException
import com.google.firebase.FirebaseTooManyRequestsException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import kotlin.coroutines.resume

class FirebaseAuthRepository @Inject constructor(
    private val firebaseAuth: FirebaseAuth
) : AuthRepository {

    companion object {
        private const val TAG = "FirebaseAuthRepository"
        const val OTP_TIMEOUT_SECONDS = 60L

        // Store verification ID temporarily (in production, use proper state management)
        var currentVerificationId: String? = null
            private set
    }

    override suspend fun sendOtp(phoneNumber: String, activity: Activity, isLogin: Boolean): AuthResult =
        suspendCancellableCoroutine { continuation ->
            val callbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                    Log.d(TAG, "onVerificationCompleted: Auto-verification succeeded")
                    // Auto-verification, but we'll still use manual OTP entry
                }

                override fun onVerificationFailed(e: FirebaseException) {
                    Log.e(TAG, "onVerificationFailed: ${e.message}", e)
                    val errorMessage = when (e) {
                        is FirebaseAuthInvalidCredentialsException ->
                            "Invalid phone number format. Please check and try again."
                        is FirebaseTooManyRequestsException ->
                            "Too many attempts. Please wait a moment before trying again."
                        else ->
                            "Unable to send OTP. Please check your internet connection and try again."
                    }
                    if (continuation.isActive) {
                        continuation.resume(AuthResult.Error(errorMessage, e))
                    }
                }

                override fun onCodeSent(
                    verificationId: String,
                    token: PhoneAuthProvider.ForceResendingToken
                ) {
                    Log.d(TAG, "onCodeSent: OTP sent successfully to $phoneNumber, verificationId: $verificationId")
                    currentVerificationId = verificationId
                    if (continuation.isActive) {
                        continuation.resume(AuthResult.OtpSent)
                    }
                }
            }

            try {
                val options = PhoneAuthOptions.newBuilder(firebaseAuth)
                    .setPhoneNumber(phoneNumber)
                    .setTimeout(OTP_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                    .setActivity(activity)
                    .setCallbacks(callbacks)
                    .build()

                PhoneAuthProvider.verifyPhoneNumber(options)
            } catch (e: Exception) {
                Log.e(TAG, "sendOtp: Unexpected error", e)
                if (continuation.isActive) {
                    continuation.resume(
                        AuthResult.Error("Something went wrong. Please try again.", e)
                    )
                }
            }

            continuation.invokeOnCancellation {
                Log.d(TAG, "sendOtp: Coroutine cancelled")
            }
        }

    override suspend fun verifyOtp(verificationId: String, otpCode: String): AuthResult =
        suspendCancellableCoroutine { continuation ->
            try {
                val credential = PhoneAuthProvider.getCredential(verificationId, otpCode)

                firebaseAuth.signInWithCredential(credential)
                    .addOnCompleteListener { task ->
                        if (task.isSuccessful) {
                            Log.d(TAG, "verifyOtp: Sign-in successful for user ${task.result?.user?.uid}")
                            if (continuation.isActive) {
                                continuation.resume(AuthResult.Success)
                            }
                        } else {
                            val exception = task.exception
                            Log.e(TAG, "verifyOtp: Sign-in failed", exception)

                            val errorMessage = when (exception) {
                                is FirebaseAuthInvalidCredentialsException ->
                                    "The OTP you entered is incorrect. Please try again."
                                else ->
                                    "Verification failed. Please try again."
                            }

                            if (continuation.isActive) {
                                continuation.resume(AuthResult.Error(errorMessage, exception))
                            }
                        }
                    }
            } catch (e: Exception) {
                Log.e(TAG, "verifyOtp: Unexpected error", e)
                if (continuation.isActive) {
                    continuation.resume(
                        AuthResult.Error("Something went wrong. Please try again.", e)
                    )
                }
            }

            continuation.invokeOnCancellation {
                Log.d(TAG, "verifyOtp: Coroutine cancelled")
            }
        }
}


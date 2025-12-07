package com.ayaan.dealora.data.auth

import android.app.Activity
import android.util.Log
import com.ayaan.dealora.data.api.BackendAuthRepository
import com.ayaan.dealora.data.api.BackendResult
import com.google.firebase.FirebaseException
import com.google.firebase.FirebaseTooManyRequestsException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import kotlin.coroutines.resume

class FirebaseAuthRepository @Inject constructor(
    private val firebaseAuth: FirebaseAuth,
    private val backendAuthRepository: BackendAuthRepository
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

    override suspend fun verifyOtp(
        verificationId: String,
        otpCode: String,
        isLogin: Boolean,
        name: String?,
        email: String?,
        phoneNumber: String?
    ): AuthResult =
        suspendCancellableCoroutine { continuation ->
            try {
                val credential = PhoneAuthProvider.getCredential(verificationId, otpCode)

                firebaseAuth.signInWithCredential(credential)
                    .addOnCompleteListener { task ->
                        if (task.isSuccessful) {
                            val firebaseUser = task.result?.user
                            val uid = firebaseUser?.uid

                            Log.d(TAG, "verifyOtp: Firebase sign-in successful for user $uid")

                            if (uid == null) {
                                if (continuation.isActive) {
                                    continuation.resume(
                                        AuthResult.Error("Failed to get user ID from Firebase")
                                    )
                                }
                                return@addOnCompleteListener
                            }

                            // Call backend API after successful Firebase auth
                            CoroutineScope(Dispatchers.IO).launch {
                                try {
                                    val backendResult = if (isLogin) {
                                        // Login flow
                                        Log.d(TAG, "Calling backend login API for uid: $uid")
                                        backendAuthRepository.login(uid)
                                    } else {
                                        // Signup flow
                                        if (name.isNullOrBlank() || email.isNullOrBlank() || phoneNumber.isNullOrBlank()) {
                                            if (continuation.isActive) {
                                                continuation.resume(
                                                    AuthResult.Error("Missing required user information for signup")
                                                )
                                            }
                                            return@launch
                                        }
                                        Log.d(TAG, "Calling backend signup API for uid: $uid")
                                        backendAuthRepository.signup(uid, name, email, phoneNumber)
                                    }

                                    when (backendResult) {
                                        is BackendResult.Success -> {
                                            Log.d(TAG, "Backend API call successful: ${backendResult.message}")
                                            if (continuation.isActive) {
                                                continuation.resume(
                                                    AuthResult.Success(backendResult.data.user)
                                                )
                                            }
                                        }
                                        is BackendResult.Error -> {
                                            Log.e(TAG, "Backend API call failed: ${backendResult.message}", backendResult.throwable)
                                            if (continuation.isActive) {
                                                continuation.resume(
                                                    AuthResult.Error(
                                                        backendResult.message,
                                                        backendResult.throwable
                                                    )
                                                )
                                            }
                                        }
                                    }
                                } catch (e: Exception) {
                                    Log.e(TAG, "Exception during backend API call", e)
                                    if (continuation.isActive) {
                                        continuation.resume(
                                            AuthResult.Error("Failed to complete authentication: ${e.localizedMessage}", e)
                                        )
                                    }
                                }
                            }
                        } else {
                            val exception = task.exception
                            Log.e(TAG, "verifyOtp: Firebase sign-in failed", exception)

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

    override fun logout() {
        try {
            Log.d(TAG, "logout: Signing out user ${firebaseAuth.currentUser?.uid}")
            firebaseAuth.signOut()
            currentVerificationId = null
            Log.d(TAG, "logout: User signed out successfully")
        } catch (e: Exception) {
            Log.e(TAG, "logout: Error during logout", e)
        }
    }
}


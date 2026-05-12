package com.ayaan.dealora.ui.presentation.splash

import androidx.lifecycle.ViewModel
import com.ayaan.dealora.data.auth.AuthRepository
import com.ayaan.dealora.data.auth.FirebaseAuthRepository
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class SplashViewModel @Inject constructor(
    private val authRepository: FirebaseAuthRepository
) : ViewModel(){
}
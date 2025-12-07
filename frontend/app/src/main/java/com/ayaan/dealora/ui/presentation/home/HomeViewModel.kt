package com.ayaan.dealora.ui.presentation.home

import android.util.Log
import androidx.lifecycle.ViewModel
import com.ayaan.dealora.data.auth.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    companion object {
        private const val TAG = "HomeViewModel"
    }

    fun logout() {
        Log.d(TAG, "logout: Initiating logout")
        authRepository.logout()
    }
}


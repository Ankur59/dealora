package com.ayaan.dealora.ui.presentation.profile

import com.ayaan.dealora.data.api.models.User

/**
 * UI state for Profile screen
 */
data class ProfileUiState(
    val isLoading: Boolean = false,
    val user: User? = null,
    val errorMessage: String? = null
)


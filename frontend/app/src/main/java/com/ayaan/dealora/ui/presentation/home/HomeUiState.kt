package com.ayaan.dealora.ui.presentation.home

import com.ayaan.dealora.data.api.models.User

/**
 * UI state for Home screen
 */
data class HomeUiState(
    val isLoading: Boolean = false,
    val user: User? = null,
    val errorMessage: String? = null
)


package com.ayaan.dealora.data.api

import com.ayaan.dealora.data.api.models.AuthResponseData

/**
 * Sealed class representing backend API call results
 */
sealed class BackendResult {
    data class Success(
        val message: String,
        val data: AuthResponseData
    ) : BackendResult()

    data class Error(
        val message: String,
        val throwable: Throwable? = null
    ) : BackendResult()
}


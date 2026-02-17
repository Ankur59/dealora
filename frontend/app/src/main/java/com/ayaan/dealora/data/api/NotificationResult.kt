package com.ayaan.dealora.data.api

/**
 * Result wrapper for Notification API calls
 */
sealed class NotificationResult<out T> {
    data class Success<out T>(val data: T, val message: String) : NotificationResult<T>()
    data class Error(val message: String, val throwable: Throwable? = null) : NotificationResult<Nothing>()
}

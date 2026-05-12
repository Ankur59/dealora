package com.ayaan.dealora.data.repository

import android.util.Log
import com.ayaan.dealora.data.api.NotificationApiService
import com.ayaan.dealora.data.api.NotificationResult
import com.ayaan.dealora.data.api.models.Notification
import com.ayaan.dealora.data.api.models.MarkReadResponse
import javax.inject.Inject

/**
 * Repository for fetching and managing notifications
 */
class NotificationRepository @Inject constructor(
    private val notificationApiService: NotificationApiService
) {
    companion object {
        private const val TAG = "NotificationRepository"
    }

    /**
     * Fetch all notifications for a user
     */
    suspend fun getNotifications(userId: String): NotificationResult<List<Notification>> {
        return try {
            Log.d(TAG, "getNotifications: Fetching notifications for userId: $userId")
            val response = notificationApiService.getNotifications(userId)
            
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.success && body.data != null) {
                    NotificationResult.Success(body.data.notifications, body.message)
                } else {
                    val errorMsg = body?.message ?: "Failed to fetch notifications"
                    Log.e(TAG, "getNotifications: Failed - $errorMsg")
                    NotificationResult.Error(errorMsg)
                }
            } else {
                val errorMsg = "Server error: ${response.code()}"
                Log.e(TAG, "getNotifications: $errorMsg")
                NotificationResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "getNotifications: Exception occurred", e)
            NotificationResult.Error("Network error: ${e.localizedMessage ?: "Unknown error"}", e)
        }
    }

    /**
     * Get unread notifications count for a user
     */
    suspend fun getUnreadCount(userId: String): NotificationResult<Int> {
        return try {
            Log.d(TAG, "getUnreadCount: Fetching unread count for userId: $userId")
            val response = notificationApiService.getUnreadCount(userId)
            
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.success && body.data != null) {
                    NotificationResult.Success(body.data.count, body.message)
                } else {
                    val errorMsg = body?.message ?: "Failed to fetch unread count"
                    Log.e(TAG, "getUnreadCount: Failed - $errorMsg")
                    NotificationResult.Error(errorMsg)
                }
            } else {
                val errorMsg = "Server error: ${response.code()}"
                Log.e(TAG, "getUnreadCount: $errorMsg")
                NotificationResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "getUnreadCount: Exception occurred", e)
            NotificationResult.Error("Network error: ${e.localizedMessage ?: "Unknown error"}", e)
        }
    }

    /**
     * Mark a notification as read
     */
    suspend fun markAsRead(notificationId: String): NotificationResult<MarkReadResponse> {
        return try {
            Log.d(TAG, "markAsRead: Marking notification $notificationId as read")
            val response = notificationApiService.markAsRead(notificationId)
            
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.success && body.data != null) {
                    NotificationResult.Success(body.data, body.message)
                } else {
                    val errorMsg = body?.message ?: "Failed to mark as read"
                    Log.e(TAG, "markAsRead: Failed - $errorMsg")
                    NotificationResult.Error(errorMsg)
                }
            } else {
                val errorMsg = "Server error: ${response.code()}"
                Log.e(TAG, "markAsRead: $errorMsg")
                NotificationResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "markAsRead: Exception occurred", e)
            NotificationResult.Error("Network error: ${e.localizedMessage ?: "Unknown error"}", e)
        }
    }
}

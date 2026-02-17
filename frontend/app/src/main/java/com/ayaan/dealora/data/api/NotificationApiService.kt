package com.ayaan.dealora.data.api

import com.ayaan.dealora.data.api.models.ApiResponse
import com.ayaan.dealora.data.api.models.MarkReadResponse
import com.ayaan.dealora.data.api.models.NotificationListResponse
import com.ayaan.dealora.data.api.models.UnreadCountResponse
import retrofit2.Response
import retrofit2.http.*

/**
 * Retrofit API interface for notification endpoints
 */
interface NotificationApiService {

    @GET("api/notifications")
    suspend fun getNotifications(
        @Query("userId") userId: String,
        @Query("type") type: String? = null,
        @Query("isRead") isRead: Boolean? = null
    ): Response<ApiResponse<NotificationListResponse>>

    @GET("api/notifications/unread-count")
    suspend fun getUnreadCount(
        @Query("userId") userId: String
    ): Response<ApiResponse<UnreadCountResponse>>

    @PATCH("api/notifications/{id}/read")
    suspend fun markAsRead(
        @Path("id") id: String
    ): Response<ApiResponse<MarkReadResponse>>
}

package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Notification model
 */
@JsonClass(generateAdapter = true)
data class Notification(
    @Json(name = "_id")
    val id: String,

    @Json(name = "title")
    val title: String,

    @Json(name = "body")
    val body: String,

    @Json(name = "createdAt")
    val createdAt: String,

    @Json(name = "isRead")
    val isRead: Boolean = false,

    @Json(name = "type")
    val type: String? = null
)

/**
 * Response data for notification list
 */
@JsonClass(generateAdapter = true)
data class NotificationListResponse(
    @Json(name = "notifications")
    val notifications: List<Notification>
)

/**
 * Response data for unread count
 */
@JsonClass(generateAdapter = true)
data class UnreadCountResponse(
    @Json(name = "count")
    val count: Int
)

/**
 * Response data for mark read
 */
@JsonClass(generateAdapter = true)
data class MarkReadResponse(
    @Json(name = "_id")
    val id: String,

    @Json(name = "isRead")
    val isRead: Boolean,

    @Json(name = "readAt")
    val readAt: String? = null
)

package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Request model for user signup
 */
@JsonClass(generateAdapter = true)
data class SignupRequest(
    @Json(name = "uid")
    val uid: String,

    @Json(name = "name")
    val name: String,

    @Json(name = "email")
    val email: String,

    @Json(name = "phone")
    val phone: String
)

/**
 * Request model for user login
 */
@JsonClass(generateAdapter = true)
data class LoginRequest(
    @Json(name = "uid")
    val uid: String
)

/**
 * Request model for FCM token update
 */
@JsonClass(generateAdapter = true)
data class FcmTokenRequest(
    @Json(name = "uid")
    val uid: String,

    @Json(name = "fcmToken")
    val fcmToken: String
)

/**
 * Request model for FCM token deletion
 */
@JsonClass(generateAdapter = true)
data class DeleteFcmTokenRequest(
    @Json(name = "uid")
    val uid: String
)

/**
 * Response model for FCM token update
 */
@JsonClass(generateAdapter = true)
data class FcmTokenResponse(
    @Json(name = "uid")
    val uid: String,

    @Json(name = "fcmToken")
    val fcmToken: String
)

/**
 * Response model for FCM token deletion
 */
@JsonClass(generateAdapter = true)
data class DeleteFcmTokenResponse(
    @Json(name = "uid")
    val uid: String
)


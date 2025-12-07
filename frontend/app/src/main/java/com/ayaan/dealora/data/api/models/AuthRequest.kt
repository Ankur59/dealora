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


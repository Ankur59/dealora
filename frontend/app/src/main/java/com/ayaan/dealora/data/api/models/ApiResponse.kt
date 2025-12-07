package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Generic API response wrapper
 */
@JsonClass(generateAdapter = true)
data class ApiResponse<T>(
    @Json(name = "success")
    val success: Boolean,

    @Json(name = "statusCode")
    val statusCode: Int? = null,

    @Json(name = "message")
    val message: String,

    @Json(name = "data")
    val data: T?
)

/**
 * Auth response data containing user information
 */
@JsonClass(generateAdapter = true)
data class AuthResponseData(
    @Json(name = "user")
    val user: User
)

/**
 * User model matching backend response
 */
@JsonClass(generateAdapter = true)
data class User(
    @Json(name = "uid")
    val uid: String,

    @Json(name = "name")
    val name: String,

    @Json(name = "email")
    val email: String,

    @Json(name = "phone")
    val phone: String,

    @Json(name = "isActive")
    val isActive: Boolean = true,

    @Json(name = "profilePicture")
    val profilePicture: String? = null,

    @Json(name = "createdAt")
    val createdAt: String,

    @Json(name = "updatedAt")
    val updatedAt: String,

    @Json(name = "lastLogin")
    val lastLogin: String? = null
)


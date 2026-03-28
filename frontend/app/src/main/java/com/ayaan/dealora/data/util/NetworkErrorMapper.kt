package com.ayaan.dealora.data.util

import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import retrofit2.HttpException

object NetworkErrorMapper {
    fun from(e: Exception): String {
        return when (e) {
            is UnknownHostException -> "Network error: Unable to connect to server. Please check your internet connection."
            is SocketTimeoutException -> "Connection timed out. Please try again later."
            is IOException -> "Network error. Please check your connection."
            is HttpException -> {
                when (e.code()) {
                    500 -> "Server is currently unavailable. Please try again later."
                    404 -> "Requested resource not found."
                    else -> "Something went wrong. Please try again."
                }
            }
            else -> e.message ?: "An unexpected error occurred. Please try again."
        }
    }
}

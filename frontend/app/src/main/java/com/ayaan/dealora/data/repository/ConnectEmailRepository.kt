package com.ayaan.dealora.data.repository

import android.util.Log
import com.ayaan.dealora.data.api.ConnectEmailApiService
import com.ayaan.dealora.data.api.models.LinkGmailRequest
import com.ayaan.dealora.data.api.models.LinkedEmail
import com.ayaan.dealora.data.api.models.RemoveEmailRequest
import javax.inject.Inject

sealed class LinkedEmailsResult {
    data class Success(val emails: List<LinkedEmail>) : LinkedEmailsResult()
    data class Error(val message: String) : LinkedEmailsResult()
}

sealed class LinkGmailResult {
    data class Success(val email: String) : LinkGmailResult()
    data class Updated(val email: String) : LinkGmailResult()   // existing email, token refreshed
    data class Error(val message: String) : LinkGmailResult()
}

sealed class RemoveEmailResult {
    data class Success(val email: String) : RemoveEmailResult()
    data class Error(val message: String) : RemoveEmailResult()
}

class ConnectEmailRepository @Inject constructor(
    private val connectEmailApiService: ConnectEmailApiService
) {
    companion object {
        private const val TAG = "ConnectEmailRepository"
    }

    suspend fun getLinkedEmails(userId: String): LinkedEmailsResult {
        return try {
            val response = connectEmailApiService.getLinkedEmails(userId)
            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true) {
                    Log.d(TAG, "Fetched ${body.count} linked email(s)")
                    LinkedEmailsResult.Success(body.data)
                } else {
                    LinkedEmailsResult.Error("Failed to fetch linked emails")
                }
            } else {
                LinkedEmailsResult.Error("HTTP ${response.code()}: ${response.message()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "getLinkedEmails exception", e)
            LinkedEmailsResult.Error(e.message ?: "Network error")
        }
    }

    /**
     * Exchange a one-time [serverAuthCode] (received from Google Sign-In on the device)
     * for a permanent refresh_token stored on the backend.
     *
     * The serverAuthCode is valid for a SINGLE use only — it must be sent to
     * the backend immediately after the sign-in result is received.
     */
    suspend fun linkGmail(serverAuthCode: String, userId: String): LinkGmailResult {
        return try {
            Log.d(TAG, "Linking Gmail for userId: $userId")
            val response = connectEmailApiService.linkGmail(
                LinkGmailRequest(serverAuthCode = serverAuthCode, userId = userId)
            )
            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true) {
                    val email = body.email ?: "Unknown"
                    return if (body.updated) {
                        Log.d(TAG, "Gmail token refreshed for: $email")
                        LinkGmailResult.Updated(email)
                    } else {
                        Log.d(TAG, "Gmail linked successfully: $email")
                        LinkGmailResult.Success(email)
                    }
                } else {
                    LinkGmailResult.Error(body?.message ?: "Failed to link Gmail")
                }
            } else {
                // Try to read the real backend error message from the response body
                val errorMsg = try {
                    val errorBody = response.errorBody()?.string()
                    val json = org.json.JSONObject(errorBody ?: "")
                    json.optString("message", "HTTP ${response.code()}: ${response.message()}")
                } catch (e: Exception) {
                    "HTTP ${response.code()}: ${response.message()}"
                }
                LinkGmailResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "linkGmail exception", e)
            LinkGmailResult.Error(e.message ?: "Network error")
        }
    }

    /**
     * Remove a linked Gmail account from the user's connected list.
     */
    suspend fun removeEmail(userId: String, email: String): RemoveEmailResult {
        return try {
            Log.d(TAG, "Removing linked email: $email for userId: $userId")
            val response = connectEmailApiService.removeEmail(
                RemoveEmailRequest(userId = userId, email = email)
            )
            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true) {
                    Log.d(TAG, "Email removed: $email")
                    RemoveEmailResult.Success(body.email ?: email)
                } else {
                    RemoveEmailResult.Error(body?.message ?: "Failed to remove email")
                }
            } else {
                val errorMsg = try {
                    val errorBody = response.errorBody()?.string()
                    val json = org.json.JSONObject(errorBody ?: "")
                    json.optString("message", "HTTP ${response.code()}: ${response.message()}")
                } catch (e: Exception) {
                    "HTTP ${response.code()}: ${response.message()}"
                }
                RemoveEmailResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "removeEmail exception", e)
            RemoveEmailResult.Error(e.message ?: "Network error")
        }
    }
}

package com.ayaan.dealora.data.api

import com.ayaan.dealora.data.api.models.LinkGmailRequest
import com.ayaan.dealora.data.api.models.LinkGmailResponse
import com.ayaan.dealora.data.api.models.LinkedEmailsResponse
import com.ayaan.dealora.data.api.models.RemoveEmailRequest
import com.ayaan.dealora.data.api.models.RemoveEmailResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * Retrofit interface for /api/connect-email endpoints.
 */
interface ConnectEmailApiService {

    @GET("api/connect-email/linked-emails")
    suspend fun getLinkedEmails(
        @Query("userId") userId: String
    ): Response<LinkedEmailsResponse>

    /**
     * Exchange a one-time serverAuthCode (from Google Sign-In) for a
     * refresh_token which is stored server-side against the user's account.
     */
    @POST("api/connect-email/link-gmail")
    suspend fun linkGmail(
        @Body request: LinkGmailRequest
    ): Response<LinkGmailResponse>

    /**
     * Remove a linked Gmail account from the user's connected list.
     */
    @POST("api/connect-email/remove-email")
    suspend fun removeEmail(
        @Body request: RemoveEmailRequest
    ): Response<RemoveEmailResponse>
}

package com.ayaan.dealora.data.api

import com.ayaan.dealora.data.api.models.TermsAcceptRequest
import com.ayaan.dealora.data.api.models.TermsAcceptResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Retrofit interface for /api/terms endpoints.
 */
interface TermsApiService {

    /**
     * Record that the user has accepted the given terms version.
     * Body: { userId (Firebase UID), termsVersion }
     */
    @POST("api/terms/accept")
    suspend fun acceptTerms(
        @Body request: TermsAcceptRequest
    ): Response<TermsAcceptResponse>
}

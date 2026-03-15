package com.ayaan.dealora.di

import com.ayaan.dealora.data.api.ConnectEmailApiService
import com.ayaan.dealora.data.api.NotificationApiService
import com.ayaan.dealora.data.api.AuthApiService
import com.ayaan.dealora.data.api.CouponApiService
import com.ayaan.dealora.data.api.FeatureApiService
import com.ayaan.dealora.data.api.ProfileApiService
import com.ayaan.dealora.data.api.TermsApiService
import com.ayaan.dealora.data.repository.ConnectEmailRepository
import com.ayaan.dealora.data.repository.GmailSyncRepository
import com.ayaan.dealora.data.repository.TermsRepository
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private const val BASE_URL ="http://10.0.2.2:3001/"
    // "https://dealora-5zcp.onrender.com/" 
    // "http://192.168.29.76:3001/"
    // IF backend on locahost 3001 use: http://10.0.2.2:3001/
    // IF backend on localhost and running on phone: http://<system ip>:3001/
    // private const val BASE_URL = "https://rheumatoid-ringlike-al.ngrok-free.dev"

    @Provides
    @Singleton
    fun provideMoshi(): Moshi {
        return Moshi.Builder()
            .add(KotlinJsonAdapterFactory())
            .build()
    }

    @Provides
    @Singleton
    fun provideHttpLoggingInterceptor(): HttpLoggingInterceptor {
        return HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
    }

    @Provides

    @Singleton
    fun provideOkHttpClient(
        loggingInterceptor: HttpLoggingInterceptor
    ): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .connectTimeout(100, TimeUnit.SECONDS)
            .readTimeout(100, TimeUnit.SECONDS)
            .writeTimeout(100, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(
        okHttpClient: OkHttpClient,
        moshi: Moshi
    ): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
    }

    @Provides
    @Singleton
    fun provideAuthApiService(retrofit: Retrofit): AuthApiService {
        return retrofit.create(AuthApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideCouponApiService(retrofit: Retrofit): CouponApiService {
        return retrofit.create(CouponApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideProfileApiService(retrofit: Retrofit): ProfileApiService {
        return retrofit.create(ProfileApiService::class.java)
    }
    @Provides
    @Singleton
    fun provideNotificationApiService(retrofit: Retrofit): NotificationApiService {
        return retrofit.create(NotificationApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideFeatureApiService(retrofit: Retrofit): FeatureApiService {
        return retrofit.create(FeatureApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideGmailSyncRepository(featureApiService: FeatureApiService): GmailSyncRepository {
        return GmailSyncRepository(featureApiService)
    }

    @Provides
    @Singleton
    fun provideConnectEmailApiService(retrofit: Retrofit): ConnectEmailApiService {
        return retrofit.create(ConnectEmailApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideConnectEmailRepository(connectEmailApiService: ConnectEmailApiService): ConnectEmailRepository {
        return ConnectEmailRepository(connectEmailApiService)
    }

    @Provides
    @Singleton
    fun provideTermsApiService(retrofit: Retrofit): TermsApiService {
        return retrofit.create(TermsApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideTermsRepository(termsApiService: TermsApiService): TermsRepository {
        return TermsRepository(termsApiService)
    }
}




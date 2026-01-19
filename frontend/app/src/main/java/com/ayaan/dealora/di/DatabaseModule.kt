package com.ayaan.dealora.di

import android.content.Context
import androidx.room.Room
import com.ayaan.dealora.data.local.DealoraDatabase
import com.ayaan.dealora.data.local.dao.SyncedAppDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDealoraDatabase(
        @ApplicationContext context: Context
    ): DealoraDatabase {
        return Room.databaseBuilder(
            context,
            DealoraDatabase::class.java,
            "dealora_database"
        ).build()
    }

    @Provides
    @Singleton
    fun provideSyncedAppDao(database: DealoraDatabase): SyncedAppDao {
        return database.syncedAppDao()
    }
}

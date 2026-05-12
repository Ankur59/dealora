package com.ayaan.dealora

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class DealoraApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val name = "Dealora Notifications"
            val descriptionText = "Notifications for Dealora coupons"
            val importance = android.app.NotificationManager.IMPORTANCE_DEFAULT
            val channel = android.app.NotificationChannel("dealora_notifications", name, importance).apply {
                description = descriptionText
            }
            val notificationManager = getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}
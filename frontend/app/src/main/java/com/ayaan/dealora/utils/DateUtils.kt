package com.ayaan.dealora.utils

import java.text.SimpleDateFormat
import java.util.*

/**
 * Utility for date formatting and time-ago calculations
 */
object DateUtils {
    /**
     * Convert an ISO 8601 date string to a human-readable "time ago" string
     */
    fun getTimeAgo(dateString: String): String {
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
        isoFormat.timeZone = TimeZone.getTimeZone("UTC")
        
        return try {
            val date = isoFormat.parse(dateString) ?: return "Unknown"
            val now = System.currentTimeMillis()
            val diff = now - date.time
            
            // Handle future dates or clock desync
            if (diff < 0) return "Just now"
            
            val seconds = diff / 1000
            val minutes = seconds / 60
            val hours = minutes / 60
            val days = hours / 24
            
            when {
                seconds < 60 -> "Just now"
                minutes < 60 -> "${minutes}m ago"
                hours < 24 -> "${hours}h ago"
                days < 7 -> "${days}d ago"
                else -> {
                    val outFormat = SimpleDateFormat("dd MMM", Locale.getDefault())
                    outFormat.format(date)
                }
            }
        } catch (e: Exception) {
            "Unknown"
        }
    }
}

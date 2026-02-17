package com.ayaan.dealora.ui.presentation.notifications

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.NotificationResult
import com.ayaan.dealora.data.api.models.Notification
import com.ayaan.dealora.data.repository.NotificationRepository
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

/**
 * UI State for the Notifications screen
 */
data class NotificationsUiState(
    val isLoading: Boolean = false,
    val todayNotifications: List<Notification> = emptyList(),
    val previousNotifications: List<Notification> = emptyList(),
    val unreadCount: Int = 0,
    val errorMessage: String? = null
)

/**
 * ViewModel for managing notification data and interactions
 */
@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val notificationRepository: NotificationRepository,
    private val firebaseAuth: FirebaseAuth
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotificationsUiState())
    val uiState: StateFlow<NotificationsUiState> = _uiState.asStateFlow()

    companion object {
        private const val TAG = "NotificationsViewModel"
    }

    init {
        fetchNotifications()
    }

    /**
     * Fetch all notifications for the current user
     */
    fun fetchNotifications() {
        val userId = firebaseAuth.currentUser?.uid
        if (userId == null) {
            _uiState.update { it.copy(errorMessage = "User not logged in") }
            return
        }
        
        _uiState.update { it.copy(isLoading = true, errorMessage = null) }
        
        viewModelScope.launch {
            when (val result = notificationRepository.getNotifications(userId)) {
                is NotificationResult.Success -> {
                    val notifications = result.data
                    val (today, previous) = categorizeNotifications(notifications)
                    
                    _uiState.update { 
                        it.copy(
                            isLoading = false,
                            todayNotifications = today,
                            previousNotifications = previous,
                            errorMessage = null
                        )
                    }
                    fetchUnreadCount()
                }
                is NotificationResult.Error -> {
                    Log.e(TAG, "fetchNotifications: Error - ${result.message}")
                    _uiState.update { 
                        it.copy(
                            isLoading = false,
                            errorMessage = result.message
                        )
                    }
                }
            }
        }
    }

    /**
     * Fetch unread notifications count
     */
    fun fetchUnreadCount() {
        val userId = firebaseAuth.currentUser?.uid ?: return
        viewModelScope.launch {
            when (val result = notificationRepository.getUnreadCount(userId)) {
                is NotificationResult.Success -> {
                    _uiState.update { it.copy(unreadCount = result.data) }
                }
                is NotificationResult.Error -> {
                    Log.e(TAG, "fetchUnreadCount: Error - ${result.message}")
                }
            }
        }
    }

    /**
     * Mark a notification as read
     */
    fun markAsRead(notificationId: String) {
        viewModelScope.launch {
            when (val result = notificationRepository.markAsRead(notificationId)) {
                is NotificationResult.Success -> {
                    Log.d(TAG, "markAsRead: Success for $notificationId")
                    updateNotificationLocally(notificationId)
                    fetchUnreadCount()
                }
                is NotificationResult.Error -> {
                    Log.e(TAG, "markAsRead: Error - ${result.message}")
                }
            }
        }
    }

    /**
     * Update notification state locally for immediate UI feedback
     */
    private fun updateNotificationLocally(notificationId: String) {
        val updateFn: (List<Notification>) -> List<Notification> = { list ->
            list.map { if (it.id == notificationId) it.copy(isRead = true) else it }
        }
        
        _uiState.update { 
            it.copy(
                todayNotifications = updateFn(it.todayNotifications),
                previousNotifications = updateFn(it.previousNotifications)
            )
        }
    }

    /**
     * Categorize notifications into Today and Previous
     */
    private fun categorizeNotifications(notifications: List<Notification>): Pair<List<Notification>, List<Notification>> {
        val todayList = mutableListOf<Notification>()
        val previousList = mutableListOf<Notification>()
        
        val now = Calendar.getInstance()
        val format = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val todayDateString = format.format(now.time)
        
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
        isoFormat.timeZone = TimeZone.getTimeZone("UTC")

        notifications.forEach { notification ->
            try {
                val date = isoFormat.parse(notification.createdAt)
                if (date != null) {
                    val notificationDateString = format.format(date)
                    if (notificationDateString == todayDateString) {
                        todayList.add(notification)
                    } else {
                        previousList.add(notification)
                    }
                } else {
                    previousList.add(notification)
                }
            } catch (e: Exception) {
                Log.e(TAG, "categorizeNotifications: Error parsing date ${notification.createdAt}")
                previousList.add(notification)
            }
        }
        
        return Pair(todayList, previousList)
    }
}

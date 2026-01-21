package com.ayaan.dealora.ui.presentation.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.ui.presentation.profile.components.TopBar

data class NotificationItem(
    val title: String,
    val description: String,
    val timeAgo: String,
    val timeBadgeColor: Color,
    val timeTextColor: Color
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(navController: NavController) {
    // Sample notification data
    val todayNotifications = listOf(
        NotificationItem(
            title = "Sync complete!",
            description = "All your selected apps are now updated.",
            timeAgo = "Just now",
            timeBadgeColor = Color(0xFFEFF4F2),
            timeTextColor = Color(0xFF408067)
        ),
        NotificationItem(
            title = "Extra cashback unlocked!",
            description = "Redeem it on your next purchase.",
            timeAgo = "1h ago",
            timeBadgeColor = Color(0xFFFFEFE4),
            timeTextColor = Color(0xFFFF7619)
        )
    )

    val previousNotifications = listOf(
        NotificationItem(
            title = "Sync complete!",
            description = "All your selected apps are now updated.",
            timeAgo = "Just now",
            timeBadgeColor = Color(0xFFEFF4F2),
            timeTextColor = Color(0xFF408067)
        ),
        NotificationItem(
            title = "Extra cashback unlocked!",
            description = "Redeem it on your next purchase.",
            timeAgo = "1h ago",
            timeBadgeColor = Color(0xFFFFEFE4),
            timeTextColor = Color(0xFFFF7619)
        ),
        NotificationItem(
            title = "Sync complete!",
            description = "All your selected apps are now updated.",
            timeAgo = "1.5h ago",
            timeBadgeColor = Color(0xFFFFEFE4),
            timeTextColor = Color(0xFFFF7619)
        ),
        NotificationItem(
            title = "Extra cashback unlocked!",
            description = "Redeem it on your next purchase.",
            timeAgo = "1h ago",
            timeBadgeColor = Color(0xFFFFEFE4),
            timeTextColor = Color(0xFFFF7619)
        )
    )

    Scaffold(
        topBar = {
            TopBar(
                navController = navController,
                title = "Notification"
            )
        },
        containerColor = Color(0xFFF0F0F0)
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Today section
            item {
                Text(
                    text = "Today",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF1E1E1E),
                    modifier = Modifier.padding(vertical = 8.dp)
                )
            }

            todayNotifications.forEach { notification ->
                item {
                    NotificationCard(notification = notification)
                }
            }

            // Previous section
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Previous",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF1E1E1E),
                    modifier = Modifier.padding(vertical = 8.dp)
                )
            }

            previousNotifications.forEach { notification ->
                item {
                    NotificationCard(notification = notification)
                }
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@Composable
fun NotificationCard(notification: NotificationItem) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(67.dp)
            .background(
                color = Color.White,
                shape = RoundedCornerShape(16.dp)
            )
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = notification.title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF1E1E1E)
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = notification.description,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Normal,
                    color = Color(0xFF747272)
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            Box(
                modifier = Modifier
                    .height(25.dp)
                    .background(
                        color = notification.timeBadgeColor,
                        shape = RoundedCornerShape(28.dp)
                    )
                    .padding(horizontal = 10.dp, vertical = 5.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = notification.timeAgo,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    color = notification.timeTextColor
                )
            }
        }
    }
}

package com.ayaan.dealora.ui.presentation.profile.notificationprefs

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.ui.presentation.profile.components.TopBar
import com.ayaan.dealora.ui.theme.AppColors
import com.ayaan.dealora.R
data class NotificationPreference(
    val title: String,
    val description: String,
    val iconColor: Color,
    @DrawableRes val iconRes: Int,
    val isEnabled: Boolean
)

@Composable
fun NotificationPreferencesScreen(navController: NavController) {
    var whatsappEnabled by remember { mutableStateOf(true) }
    var smsEnabled by remember { mutableStateOf(false) }

    val notificationItems = listOf(
        NotificationPreference(
            title = "Receive Whatsapp Messages",
            description = "Receive occasional updates and offers from partners.",
            iconColor = Color.Transparent,
            iconRes = R.drawable.whatsapp,
            isEnabled = whatsappEnabled
        ),
        NotificationPreference(
            title = "Receive SMS Messages",
            description = "Receive occasional updates and offers from partners.",
            iconColor = Color.Transparent,
            iconRes = R.drawable.sms,
            isEnabled = smsEnabled
        )
    )

    Scaffold(
        topBar = {
            TopBar(
                navController = navController,
                title = "Notification Preferences"
            )
        },
        containerColor = AppColors.Background
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(4.dp))
            }

            item {
                NotificationPreferenceCard(
                    preference = notificationItems[0],
                    onToggle = { whatsappEnabled = !whatsappEnabled }
                )
            }

            item {
                NotificationPreferenceCard(
                    preference = notificationItems[1],
                    onToggle = { smsEnabled = !smsEnabled }
                )
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@Composable
fun NotificationPreferenceCard(
    preference: NotificationPreference,
    onToggle: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = AppColors.CardBackground
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = 1.dp
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                horizontalArrangement = Arrangement.Start,
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                // Icon with colored background
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(preference.iconColor),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(id = preference.iconRes),
                        contentDescription = preference.title,
                        modifier = Modifier.size(24.dp)
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                // Text Content
                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = preference.title,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        color = AppColors.PrimaryText
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = preference.description,
                        fontSize = 13.sp,
                        color = AppColors.SecondaryText,
                        lineHeight = 18.sp
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Toggle Switch
            Switch(
                checked = preference.isEnabled,
                onCheckedChange = { onToggle() },
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = Color(0xFF4CAF50),
                    uncheckedThumbColor = Color.White,
                    uncheckedTrackColor = Color(0xFFE0E0E0)
                )
            )
        }
    }
}
package com.ayaan.dealora.ui.presentation.profile.appprivacy

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.ui.presentation.profile.components.TopBar
import com.ayaan.dealora.ui.theme.AppColors

data class PrivacyItem(
    val title: String,
    val description: String
)

@Composable
fun AppPrivacyScreen(navController: NavController) {
    val privacyItems = listOf(
        PrivacyItem(
            title = "Privacy Policy",
            description = "Your privacy is important to us. We securely store your account information and never share personal data with third parties without your consent. Any permissions you grant—such as syncing apps or accessing offers—are used only to improve your experience and provide relevant deals."
        ),
        PrivacyItem(
            title = "Terms and Condition",
            description = "Your privacy is important to us. We securely store your account information and never share personal data with third parties without your consent. Any permissions you grant—such as syncing apps or accessing offers—are used only to improve your experience and provide relevant deals."
        )
    )

    Scaffold(
        topBar = {
            TopBar(
                navController = navController,
                title = "App Privacy"
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

            items(privacyItems) { item ->
                PrivacyCard(privacyItem = item)
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@Composable
fun PrivacyCard(privacyItem: PrivacyItem) {
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
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            // Title
            Text(
                text = privacyItem.title,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Description
            Text(
                text = privacyItem.description,
                fontSize = 14.sp,
                color = AppColors.SecondaryText,
                lineHeight = 20.sp
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Read More Button
            Text(
                text = "Read More",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
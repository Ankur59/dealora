package com.ayaan.dealora.ui.presentation.profile.about

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.ui.presentation.profile.components.TopBar
import com.ayaan.dealora.ui.theme.AppColors
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun AboutUsScreen(navController: NavController) {
    Scaffold(
        topBar = {
            TopBar(
                navController = navController,
                title = "About Us"
            )
        },
        containerColor = AppColors.Background
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(0.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(16.dp))
            }

            item {
                AboutUsCard()
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@Composable
fun AboutUsCard() {
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
                .padding(24.dp)
        ) {
            Row(
                modifier = Modifier.wrapContentWidth(),
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
            ) {
                Text(
                    text = "About ",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.PrimaryText
                )
                Box(
                    modifier = Modifier
                        .background(
                            color = DealoraPrimary,
                            shape = RoundedCornerShape(6.dp)
                        )
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Dealora",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // First Description Paragraph
            Text(
                text = "Your privacy is important to us. We securely store your account information and never share personal data with third parties without your consent. Any permissions you grant—such as syncing apps or accessing offers—are used only to improve your experience and provide relevant deals.",
                fontSize = 14.sp,
                color = AppColors.SecondaryText,
                lineHeight = 22.sp
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Second Description Paragraph
            Text(
                text = "Your privacy is important to us. We securely store your account information and never share personal data with third parties without your consent. Any permissions you grant—such as syncing apps or accessing offers—are used only to improve your experience and provide relevant deals.",
                fontSize = 14.sp,
                color = AppColors.SecondaryText,
                lineHeight = 22.sp
            )
        }
    }
}
package com.ayaan.dealora.ui.presentation.profile.accountprivacy

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.navigation.NavController
import com.ayaan.dealora.ui.presentation.profile.components.TopBar
import com.ayaan.dealora.ui.theme.AppColors
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun AccountPrivacyScreen(navController: NavController) {
    var showDeleteDialog by remember { mutableStateOf(false) }
    Scaffold(
        topBar = {
            TopBar(
                navController = navController,
                title = "Account Privacy"
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

            // Privacy Policy Card
            item {
                PrivacyPolicyCard()
            }

            // Delete Account Card
            item {
                DeleteAccountCard(
                    onClick = {
                        showDeleteDialog = true
                    }
                )
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }

        // Delete Account Dialog
        if (showDeleteDialog) {
            DeleteAccountDialog(
                onDismiss = { showDeleteDialog = false },
                onConfirm = {
                    showDeleteDialog = false
                }
            )
        }
    }
}

@Composable
fun DeleteAccountDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .wrapContentHeight(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = AppColors.CardBackground
            )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Are you sure do you want to",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = AppColors.PrimaryText,
                            lineHeight = 24.sp
                        )
                        Text(
                            text = "Delete your account ?",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = AppColors.PrimaryText,
                            lineHeight = 24.sp
                        )
                    }

                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = AppColors.IconTint
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Description text
                Text(
                    text = "Deleting your account will erase all your data",
                    fontSize = 14.sp,
                    color = AppColors.SecondaryText,
                    lineHeight = 20.sp
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Delete Button
                Button(
                    onClick = onConfirm,
                    modifier = Modifier
                        .align(Alignment.End)
                        .height(48.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = DealoraPrimary
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "Delete",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White
                    )
                }
            }
        }
    }
}

@Composable
fun PrivacyPolicyCard() {
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
                text = "Account Privacy and Policy",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Description
            Text(
                text = "Your privacy is important to us. We securely store your account information and never share personal data with third parties without your consent. Any permissions you grant—such as syncing apps or accessing offers—are used only to improve your experience and provide relevant deals.",
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

@Composable
fun DeleteAccountCard(onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = AppColors.CardBackground
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = 1.dp
        ),
        onClick = onClick
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
                // Delete Icon
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "Delete Account",
                    tint = AppColors.IconTint,
                    modifier = Modifier.size(24.dp)
                )

                Spacer(modifier = Modifier.width(16.dp))

                // Text Content
                Column {
                    Text(
                        text = "Request to Delete Account",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        color = AppColors.PrimaryText
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = "Request to closure your account",
                        fontSize = 13.sp,
                        color = AppColors.SecondaryText
                    )
                }
            }

            // Arrow Icon
            Icon(
                imageVector = Icons.Default.KeyboardArrowRight,
                contentDescription = "Navigate",
                tint = AppColors.IconTint,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}
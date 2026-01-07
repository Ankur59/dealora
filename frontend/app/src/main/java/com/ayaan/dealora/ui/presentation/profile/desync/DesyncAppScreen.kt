package com.ayaan.dealora.ui.presentation.profile.desync

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.navigation.NavController
import com.ayaan.dealora.ui.theme.AppColors
import com.ayaan.dealora.R
data class ActiveApp(
    val name: String,
    @DrawableRes val iconRes: Int
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DesyncAppScreen(navController: NavController) {
    var showRemoveDialog by remember { mutableStateOf(false) }
    var selectedApp by remember { mutableStateOf<ActiveApp?>(null) }
    val activeApps = listOf(
        ActiveApp("Phone Pay", R.drawable.phonepay),
        ActiveApp("Blinkit", R.drawable.blinkit),
        ActiveApp("Myntra", R.drawable.myntra),
        ActiveApp("Cred", R.drawable.cred),
        ActiveApp("Nykaa", R.drawable.nykaa),
        ActiveApp("Flipkart", R.drawable.flipkart)
    )

    Scaffold(
        topBar = {
            DesyncTopBar(navController = navController)
        },
        containerColor = AppColors.Background
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Active Apps Header
            Text(
                text = "Active Apps",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp)
            )

            // Active Apps List
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(activeApps) { app ->
                    ActiveAppCard(
                        app = app,
                        onRemoveClick = {
                            selectedApp = app
                            showRemoveDialog = true
                        }
                    )
                }

                item {
                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }

        // Remove Synced App Dialog
        if (showRemoveDialog) {
            RemoveSyncedAppDialog(
                onDismiss = {
                    showRemoveDialog = false
                    selectedApp = null
                },
                onConfirm = {
                    // Handle de-sync app logic here
                    showRemoveDialog = false
                    selectedApp = null
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DesyncTopBar(navController: NavController) {
    TopAppBar(
        title = {
            Text(
                text = "Desync App",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText
            )
        },
        navigationIcon = {
            IconButton(onClick = { navController.navigateUp() }) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = AppColors.IconTint
                )
            }
        },
        actions = {
            IconButton(onClick = { /* Handle search */ }) {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Search",
                    tint = AppColors.IconTint
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = AppColors.Background
        )
    )
}

@Composable
fun ActiveAppCard(
    app: ActiveApp,
    onRemoveClick: () -> Unit
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
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                horizontalArrangement = Arrangement.Start,
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                // App Icon
                Image(
                    painter = painterResource(id = app.iconRes),
                    contentDescription = app.name,
                    modifier = Modifier.size(40.dp)
                )

                Spacer(modifier = Modifier.width(16.dp))

                // App Name
                Text(
                    text = app.name,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = AppColors.PrimaryText
                )
            }

            // Remove Button
            OutlinedButton(
                onClick = onRemoveClick,
                modifier = Modifier
                    .wrapContentWidth()
                    .height(36.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = AppColors.CardBackground,
                    contentColor = AppColors.PrimaryText
                ),
                border = ButtonDefaults.outlinedButtonBorder.copy(
                    width = 1.dp
                )
            ) {
                Text(
                    text = "Remove",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Normal
                )
            }
        }
    }
}

@Composable
fun RemoveSyncedAppDialog(
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
                // Header with close button
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
                            text = "De-sync this App ?",
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
                    text = "De-sync will delete all the coupons from this app.",
                    fontSize = 14.sp,
                    color = AppColors.SecondaryText,
                    lineHeight = 20.sp
                )

                Spacer(modifier = Modifier.height(24.dp))

                // De-Sync Button
                Button(
                    onClick = onConfirm,
                    modifier = Modifier
                        .align(Alignment.End)
                        .height(48.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF5B4CFF)
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "De-Sync",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White
                    )
                }
            }
        }
    }
}
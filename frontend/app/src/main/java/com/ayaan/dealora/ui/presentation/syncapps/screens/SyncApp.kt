package com.ayaan.dealora.ui.presentation.syncapps.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.presentation.syncapps.viewmodels.SelectAppsViewModel
import com.ayaan.dealora.ui.theme.DealoraPrimary

data class SyncApp(
    val id: String, val name: String, val iconRes: Int
)

@Composable
fun SelectAppsScreen(
    onAllowSyncClick: (List<String>) -> Unit, navController: NavController,
    viewModel: SelectAppsViewModel = hiltViewModel()
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedApps by remember { mutableStateOf(setOf<String>()) }

    val syncedAppIds by viewModel.syncedAppIds.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    val apps = listOf(
        SyncApp("zomato", "Zomato", R.drawable.zomato_logo),
        SyncApp("phonepe", "Phone Pay", R.drawable.phonepe_logo),
        SyncApp("blinkit", "Blinkit", R.drawable.blinkit_logo),
        SyncApp("amazon", "Amazon", R.drawable.azon_logo),
        SyncApp("nykaa", "Nykaa", R.drawable.nykaa_logo),
        SyncApp("cred", "CRED", R.drawable.cred_logo),
        SyncApp("swiggy", "Swiggy", R.drawable.swiggy_logo),
        SyncApp("dealora", "Dealora", R.drawable.logo),
    )

    // Filter out apps that are already synced
    val availableApps = apps.filter { app ->
        !syncedAppIds.contains(app.id.lowercase())
    }

    val filteredApps = availableApps.filter {
        it.name.contains(searchQuery, ignoreCase = true)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(40.dp))

        // Title Section
        Column(
            horizontalAlignment = Alignment.Start, modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "Select the Apps you",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black,
                lineHeight = 34.sp
            )

            Box(
                modifier = Modifier
                    .background(
                        color = DealoraPrimary, shape = RoundedCornerShape(4.dp)
                    )
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = "Want to Sync",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Description Text
        Text(
            text = "Choose the apps you want to sync and grant access. We'll only read coupon-related data, nothing personal.",
            fontSize = 14.sp,
            color = Color.Black,
            lineHeight = 20.sp,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Search Field
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = {
                Text(
                    text = "Search Apps", color = Color.Gray, fontSize = 15.sp
                )
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Search",
                    tint = Color.Gray
                )
            },
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = DealoraPrimary, unfocusedBorderColor = Color(0xFFE0E0E0)
            ),
            shape = RoundedCornerShape(12.dp),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Apps Grid with Loading and Empty States
        if (isLoading) {
            // Loading State
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = DealoraPrimary)
            }
        } else if (availableApps.isEmpty()) {
            // Empty State - All apps are synced
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Text(
                        text = "All Apps Synced! 🎉",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.Black
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "You've already synced all available apps. Check De-Sync Apps to manage them.",
                        fontSize = 14.sp,
                        color = Color.Gray,
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else if (filteredApps.isEmpty()) {
            // No search results
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No apps found",
                    fontSize = 16.sp,
                    color = Color.Gray
                )
            }
        } else {
            // Apps Grid
            LazyVerticalGrid(
                columns = GridCells.Fixed(4),
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                items(filteredApps) { app ->
                    AppItem(
                        app = app, isSelected = selectedApps.contains(app.id), onToggleSelection = {
                            selectedApps = if (selectedApps.contains(app.id)) {
                                selectedApps - app.id
                            } else {
                                selectedApps + app.id
                            }
                        })
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Privacy Text
        Text(
            text = buildAnnotatedString {
                append("Your information stays ")
                withStyle(
                    style = SpanStyle(
                        color = DealoraPrimary, fontWeight = FontWeight.SemiBold
                    )
                ) {
                    append("Private")
                }
                append(" and ")
                withStyle(
                    style = SpanStyle(
                        color = DealoraPrimary, fontWeight = FontWeight.SemiBold
                    )
                ) {
                    append("Encrypted.")
                }
            },
            fontSize = 14.sp,
            color = Color.Black,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Allow Sync Button
        Button(
            onClick = {
                onAllowSyncClick(selectedApps.toList())
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = DealoraPrimary
            ),
            shape = RoundedCornerShape(8.dp),
            enabled = selectedApps.isNotEmpty()
        ) {
            Text(
                text = "Allow Sync",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
fun AppItem(
    app: SyncApp, isSelected: Boolean, onToggleSelection: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.clickable { onToggleSelection() }) {
            // App Icon
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .background(
                        color = Color.White, shape = RoundedCornerShape(16.dp)
                    )
                    .border(
                        width = if (isSelected) 2.dp else 1.dp,
                        color = if (isSelected) DealoraPrimary else Color(0xFFE0E0E0),
                        shape = RoundedCornerShape(16.dp)
                    ), contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = app.iconRes),
                    contentDescription = app.name,
                    modifier = Modifier.size(48.dp)
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            // App Name
            Text(
                text = app.name,
                fontSize = 12.sp,
                color = Color.Black,
                maxLines = 1,
                textAlign = TextAlign.Center
            )
        }

        // Selection Indicator (blue dot)
        if (isSelected) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(end = 8.dp)
                    .size(16.dp)
                    .background(DealoraPrimary, CircleShape)
                    .border(2.dp, Color.White, CircleShape)
            )
        }
    }
}
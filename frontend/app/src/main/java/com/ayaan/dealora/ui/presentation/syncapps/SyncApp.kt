package com.ayaan.dealora.ui.presentation.syncapps

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
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.theme.DealoraPrimary

data class SyncApp(
    val id: String, val name: String, val iconRes: Int // Drawable resource for app icon
)

@Composable
fun SelectAppsScreen(
    onAllowSyncClick: (List<String>) -> Unit, navController: NavController
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedApps by remember { mutableStateOf(setOf<String>()) }

    val apps = listOf(
        SyncApp("zomato", "Zomato", R.drawable.zomato_logo),
        SyncApp("phonepe", "Phone Pay", R.drawable.phonepe_logo),
        SyncApp("blinkit", "Blinkit", R.drawable.blinkit_logo),
        SyncApp("amazon", "Amazon", R.drawable.azon_logo),
        SyncApp("nykaa", "Nykaa", R.drawable.nykaa_logo),
        SyncApp("cred", "CRED", R.drawable.cred_logo),
        SyncApp("swiggy", "Swiggy", R.drawable.swiggy_logo),
//        SyncApp("zepto", "Zepto", R.drawable.logo),
//        SyncApp("licious", "Licious", R.drawable.zomato_logo),
        SyncApp("dealora", "Dealora", R.drawable.logo),
//        SyncApp("nykaa", "Nykaa", R.drawable.zomato_logo),
//        SyncApp("cred", "CRED", R.drawable.logo),
    )
    val filteredApps = apps.filter {
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

        // Apps Grid
//        val filteredApps = apps.filter {
//            it.name.contains(searchQuery, ignoreCase = true)
//        }

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
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
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
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
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
//
//@Preview(showBackground = true, showSystemUi = true)
//@Composable
//fun SelectAppsScreenPreview() {
//    SelectAppsScreen()
//}
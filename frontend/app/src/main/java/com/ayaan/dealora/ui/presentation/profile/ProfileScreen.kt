package com.ayaan.dealora.ui.presentation.profile

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.ui.theme.AppColors
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun ProfileScreen(
    navController: NavController, viewModel: ProfileViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    val gradientColors = listOf(
        Color(0xFF1B8B8F), Color(0xFF7DDFE3), Color.White
    )

    Box(
        modifier = Modifier.fillMaxSize()
    ) {
        // Gradient Background
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.verticalGradient(
                        colors = gradientColors
                    )
                )
        )

        when {
            uiState.isLoading -> {
                // Loading State
                Box(
                    modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        color = Color.White, modifier = Modifier.size(48.dp)
                    )
                }
            }

            uiState.errorMessage != null -> {
                // Error State with Retry Button
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = uiState.errorMessage ?: "An error occurred",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { viewModel.retry() }, colors = ButtonDefaults.buttonColors(
                            containerColor = Color.White, contentColor = Color(0xFF0D7275)
                        ), shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "Retry", fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            else -> {
                // Content State
                ProfileContent(
                    navController = navController,
                    name = uiState.user?.name ?: "",
                    phone = uiState.user?.phone ?: "",
                    email = uiState.user?.email ?: "",
                    onSaveChanges = { name, email, phone ->
                        viewModel.updateProfile(name, email, phone)
                    },
                    onLogout = {
                        viewModel.logout()
                        navController.navigate(Route.SignIn.path) {
                            popUpTo(0) { inclusive = true }
                        }
                    })
            }
        }
    }
}

@Composable
fun ProfileContent(
    navController: NavController,
    name: String,
    phone: String,
    email: String,
    onSaveChanges: (String, String, String) -> Unit = { _, _, _ -> },
    onLogout: () -> Unit = {}
) {
    var showLogoutDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
    ) {
        ProfileTopBar(
            navController = navController,
            name = name,
            email = email,
            phone = phone,
            onSaveChanges = onSaveChanges
        )
        Spacer(modifier = Modifier.height(16.dp))
        Box(
            modifier = Modifier
                .size(100.dp)
                .align(Alignment.CenterHorizontally)
                .clip(CircleShape)
                .background(Color.White), contentAlignment = Alignment.Center
        ) {
            Image(
                painter = painterResource(R.drawable.profile_placeholder),
                contentDescription = "Profile Picture",
                modifier = Modifier.size(60.dp)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Name
        Text(
            text = name,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xff0D7275),
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Contact Info
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = phone, fontSize = 14.sp, fontWeight = FontWeight.Normal, color = Color.Black
            )
            Text(
                text = "  •  ", fontSize = 14.sp, color = Color.Black
            )
            Text(
                text = email, fontSize = 14.sp, fontWeight = FontWeight.Normal, color = Color.Black
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Coupon Stats
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            CouponStatItem("Active\ncoupons", R.drawable.coupons)
            CouponStatItem("Expired\ncoupons", R.drawable.coupons)
            CouponStatItem("Redeemed\ncoupons", R.drawable.coupons)
            CouponStatItem("Saved\ncoupons", R.drawable.coupons)
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Sync Coupons Card
        MenuCard(
            icon = R.drawable.sync_coupons, text = "Sync coupons from other apps", onClick = { })

        Spacer(modifier = Modifier.height(12.dp))

        // De-Sync Apps Card
        MenuCard(
            icon = R.drawable.desync_coupons, text = "De-Sync Apps", onClick = { navController.navigate(Route.DesyncApps.path)})

        Spacer(modifier = Modifier.height(24.dp))

        // Support Section
        Text(
            text = "Support",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.Black,
            modifier = Modifier.padding(horizontal = 16.dp)
        )

        Spacer(modifier = Modifier.height(12.dp))

        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color.White
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column {
                MenuItem(R.drawable.contact_support, "Contact support", {
                    navController.navigate(
                        Route.ContactSupport.path
                    )
                })
                MenuDivider()
                MenuItem(R.drawable.faq, "FAQ", {
                    navController.navigate(
                        Route.FAQ.path
                    )
                })
                MenuDivider()
                MenuItem(R.drawable.app_privacy, "App Privacy", {
                    navController.navigate(
                        Route.AppPrivacy.path
                    )
                })
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Other Information Section
        Text(
            text = "Other information",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.Black,
            modifier = Modifier.padding(horizontal = 16.dp)
        )

        Spacer(modifier = Modifier.height(12.dp))

        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color.White
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column {
                MenuItem(R.drawable.share, "Share the app") { }
                MenuDivider()
                MenuItem(
                    R.drawable.about_us, "About Us", { navController.navigate(Route.AboutUs.path) })
                MenuDivider()
                MenuItem(
                    R.drawable.account_privacy,
                    "Account Privacy",
                    { navController.navigate(Route.AccountPrivacy.path) })
                MenuDivider()
                MenuItem(
                    R.drawable.notification,
                    "Notification Preferences",
                    { navController.navigate(Route.NotificationPreferences.path) })
                MenuDivider()
                MenuItem(R.drawable.logout, "Logout") { showLogoutDialog = true }
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
    }

    // Show Logout Dialog
    if (showLogoutDialog) {
        LogOutDialog(onDismiss = { showLogoutDialog = false }, onConfirm = {
            showLogoutDialog = false
            onLogout()
        })
    }
}

@Composable
fun CouponStatItem(label: String, iconRes: Int) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(80.dp)
    ) {
        Box(
            modifier = Modifier
                .size(60.dp)
                .border(
                    width = 2.dp, color = Color(0xff0D7275), shape = CircleShape
                )
                .background(Color.Transparent, CircleShape), contentAlignment = Alignment.Center
        ) {
            Icon(
                painter = painterResource(iconRes),
                contentDescription = label,
                tint = Color(0xff0D7275),
                modifier = Modifier.size(28.dp)
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Normal,
            color = Color.Black,
            textAlign = TextAlign.Center,
            lineHeight = 14.sp
        )
    }
}

@Composable
fun MenuCard(icon: Int, text: String, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color.White
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(12.dp),
        onClick = onClick
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    painter = painterResource(icon),
                    contentDescription = text,
                    tint = Color.Black,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = text,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.Black
                )
            }
            Icon(
                painter = painterResource(R.drawable.arrow_right),
                contentDescription = "Navigate",
                tint = Color.Gray,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
fun MenuItem(icon: Int, text: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .clickable { onClick() },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                painter = painterResource(icon),
                contentDescription = text,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = text, fontSize = 14.sp, fontWeight = FontWeight.Normal, color = Color.Black
            )
        }
        Icon(
            painter = painterResource(R.drawable.arrow_right),
            contentDescription = "Navigate",
            tint = Color.Gray,
            modifier = Modifier.size(20.dp)
        )
    }
}

@Composable
fun MenuDivider() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .padding(horizontal = 16.dp)
            .background(Color.LightGray.copy(alpha = 0.3f))
    )
}

@Composable
fun ProfileTopBar(
    navController: NavController,
    name: String,
    email: String,
    phone: String,
    onSaveChanges: (String, String, String) -> Unit
) {
    var showEditDialog by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(
            onClick = { navController.popBackStack() },
            modifier = Modifier
                .size(30.dp)
                .background(Color.White, CircleShape)
        ) {
            Icon(
                painter = painterResource(R.drawable.arrow_left),
                contentDescription = "Back",
                tint = Color(0xFF0D7275),
                modifier = Modifier.size(25.dp)
            )
        }

        Text(
            text = "Edit",
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            color = Color.White,
            modifier = Modifier.clickable { showEditDialog = true })
    }

    if (showEditDialog) {
        EditProfileDialog(
            name = name,
            email = email,
            phone = phone,
            onDismiss = { showEditDialog = false },
            onSave = { newName, newEmail, newPhone ->
                onSaveChanges(newName, newEmail, newPhone)
                showEditDialog = false
            })
    }
}

@Composable
fun EditProfileDialog(
    name: String,
    email: String,
    phone: String,
    onDismiss: () -> Unit,
    onSave: (String, String, String) -> Unit
) {
    var editedName by remember { mutableStateOf(name) }
    var editedEmail by remember { mutableStateOf(email) }
    var editedPhone by remember { mutableStateOf(phone) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color.White
            )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 14.dp)
            ) {
                // Close Button
                Box(
                    modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.TopEnd
                ) {
                    IconButton(
                        onClick = onDismiss, modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = Color.Black
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Name Field
                Text(
                    text = "Name",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.Black
                )
                Spacer(modifier = Modifier.height(2.dp))
                OutlinedTextField(
                    value = editedName,
                    onValueChange = { editedName = it },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0xFF0D7275),
                        unfocusedBorderColor = Color.LightGray,
                        focusedContainerColor = Color(0xFFF5F5F5),
                        unfocusedContainerColor = Color(0xFFF5F5F5)
                    ),
                    shape = RoundedCornerShape(8.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Email Field
                Text(
                    text = "Email",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.Black
                )
                Spacer(modifier = Modifier.height(2.dp))
                OutlinedTextField(
                    value = editedEmail,
                    onValueChange = { editedEmail = it },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0xFF0D7275),
                        unfocusedBorderColor = Color.LightGray,
                        focusedContainerColor = Color(0xFFF5F5F5),
                        unfocusedContainerColor = Color(0xFFF5F5F5)
                    ),
                    shape = RoundedCornerShape(8.dp)
                )

//                Spacer(modifier = Modifier.height(16.dp))
//                // Phone Number Field
//                Text(
//                    text = "Phone Number",
//                    fontSize = 14.sp,
//                    fontWeight = FontWeight.Medium,
//                    color = Color.Black
//                )
//                Spacer(modifier = Modifier.height(2.dp))
//                Row(
//                    modifier = Modifier.fillMaxWidth(),
//                    verticalAlignment = Alignment.CenterVertically
//                ) {
//                    // Country Code
//                    Box(
//                        modifier = Modifier
//                            .background(Color(0xFFF5F5F5), RoundedCornerShape(8.dp))
//                            .border(1.dp, Color.LightGray, RoundedCornerShape(8.dp))
//                            .padding(horizontal = 12.dp, vertical = 16.dp)
//                    ) {
//                        Row(verticalAlignment = Alignment.CenterVertically) {
//                            Text(text = "🇮🇳", fontSize = 20.sp)
//                            Spacer(modifier = Modifier.width(4.dp))
//                            Text(
//                                text = "+91",
//                                fontSize = 14.sp,
//                                color = Color.Black
//                            )
//                        }
//                    }
//
//                    Spacer(modifier = Modifier.width(12.dp))
//
//                    // Phone Number
//                    OutlinedTextField(
//                        value = editedPhone,
//                        onValueChange = { editedPhone = it },
//                        modifier = Modifier.weight(1f),
//                        colors = OutlinedTextFieldDefaults.colors(
//                            focusedBorderColor = Color(0xFF0D7275),
//                            unfocusedBorderColor = Color.LightGray,
//                            focusedContainerColor = Color(0xFFF5F5F5),
//                            unfocusedContainerColor = Color(0xFFF5F5F5)
//                        ),
//                        shape = RoundedCornerShape(8.dp),
//                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
//                    )
//                }

                Spacer(modifier = Modifier.height(24.dp))

                // Save Changes Button
                Button(
                    onClick = { onSave(editedName, editedEmail, editedPhone) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF0D7275)
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "Save Changes",
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
fun LogOutDialog(
    onDismiss: () -> Unit, onConfirm: () -> Unit
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
                            text = "Logout your account ?",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = AppColors.PrimaryText,
                            lineHeight = 24.sp
                        )
                    }

                    IconButton(
                        onClick = onDismiss, modifier = Modifier.size(24.dp)
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
                    text = "You’ll need to sign in again to access your account.",
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
                        text = "Logout",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White
                    )
                }
            }
        }
    }
}
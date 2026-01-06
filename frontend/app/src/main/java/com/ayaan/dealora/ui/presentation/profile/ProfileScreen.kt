package com.ayaan.dealora.ui.presentation.profile

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.R

@Composable
fun ProfileScreen(navController: NavController) {
    val gradientColors = listOf(
        Color(0xFF1B8B8F),
        Color(0xFF7DDFE3)
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

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
        ) {
            // Top Bar
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
                        .size(40.dp)
                        .background(Color.White, CircleShape)
                ) {
                    Icon(
                        painter = painterResource(R.drawable.arrow_left),
                        contentDescription = "Back",
                        tint = Color(0xFF0D7275),
                        modifier = Modifier.size(20.dp)
                    )
                }

                Text(
                    text = "Edit",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Profile Picture
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .align(Alignment.CenterHorizontally)
                    .clip(CircleShape)
                    .background(Color.White),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(R.drawable.profile_placeholder),
                    contentDescription = "Profile Picture",
                    modifier = Modifier.size(100.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Name
            Text(
                text = "Tanishka Rai",
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
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
                    text = "7276239311",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Normal,
                    color = Color.White
                )
                Text(
                    text = "  •  ",
                    fontSize = 14.sp,
                    color = Color.White
                )
                Text(
                    text = "raitanishka01@.com",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Normal,
                    color = Color.White
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
                icon = R.drawable.sync_coupons,
                text = "Sync coupons from other apps",
                onClick = { }
            )

            Spacer(modifier = Modifier.height(12.dp))

            // De-Sync Apps Card
            MenuCard(
                icon = R.drawable.desync_coupons,
                text = "De-Sync Apps",
                onClick = { }
            )

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
                    MenuItem(R.drawable.contact_support, "Contact support") { }
                    MenuDivider()
                    MenuItem(R.drawable.faq, "FAQ") { }
                    MenuDivider()
                    MenuItem(R.drawable.app_privacy, "App Privacy") { }
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
                    MenuItem(R.drawable.about_us, "About Us") { }
                    MenuDivider()
                    MenuItem(R.drawable.account_privacy, "Account Privacy") { }
                    MenuDivider()
                    MenuItem(R.drawable.notification, "Notification Preferences") { }
                    MenuDivider()
                    MenuItem(R.drawable.logout, "Logout") { }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
fun CouponStatItem(label: String, iconRes: Int) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(80.dp)
    ) {
        Box(
            modifier = Modifier
                .size(60.dp)
                .border(
                    width = 2.dp,
                    color = Color.White,
                    shape = CircleShape
                )
                .background(Color.Transparent, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                painter = painterResource(iconRes),
                contentDescription = label,
                tint = Color.White,
                modifier = Modifier.size(28.dp)
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Normal,
            color = Color.White,
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
                tint = Color(0xFF0D7275),
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = text,
                fontSize = 14.sp,
                fontWeight = FontWeight.Normal,
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
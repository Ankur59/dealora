package com.ayaan.dealora.ui.presentation.couponsList.coupondetails

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.ui.presentation.profile.components.TopBar
import com.ayaan.dealora.ui.theme.AppColors

@Composable
fun CouponDetailsScreen(navController: NavController) {
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Details", "How to redeem", "Terms & condition")

    Scaffold(topBar = {
        TopBar(
            navController = navController, title = "Details"
        )
    }, containerColor = AppColors.Background, bottomBar = {
        BottomActionButtons()
    }) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Brand Header
            item {
                BrandHeader()
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Product Images
//            item {
//                ProductImages()
//            }

//            item {
//                Spacer(modifier = Modifier.height(16.dp))
//            }

            // Offer Title
            item {
                OfferTitle()
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Coupon Code Card
            item {
                CouponCodeCard()
            }

            item {
                Spacer(modifier = Modifier.height(24.dp))
            }

            // About Section with Tabs
            item {
                Text(
                    text = "About",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.PrimaryText
                )
            }

            item {
                Spacer(modifier = Modifier.height(12.dp))
            }

            // Tab Row
            item {
                TabRow(
                    selectedTab = selectedTab, tabs = tabs, onTabSelected = { selectedTab = it })
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Tab Content
            item {
                when (selectedTab) {
                    0 -> DetailsContent()
                    1 -> HowToRedeemContent()
                    2 -> TermsAndConditionsContent()
                }
            }

            item {
                Spacer(modifier = Modifier.height(100.dp))
            }
        }
    }
}

@Composable
fun BrandHeader() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Brand Logo
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(Color(0xFF00BFA5)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "mC", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White
            )
        }

        Column {
            Text(
                text = "mCaffeine",
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText
            )

            Spacer(modifier = Modifier.height(8.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Chip(text = "Beauty", backgroundColor = Color(0xFFE8DCFF))
                Chip(text = "Expire in 12 days", backgroundColor = Color(0xFFE8DCFF))
            }
        }
    }
}

@Composable
fun Chip(text: String, backgroundColor: Color) {
    Box(
        modifier = Modifier
            .background(backgroundColor, RoundedCornerShape(16.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Text(
            text = text, fontSize = 12.sp, color = Color(0xFF5B4CFF), fontWeight = FontWeight.Medium
        )
    }
}

@Composable
fun ProductImages() {
    Row(
        modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Replace with actual images
        Box(
            modifier = Modifier
                .weight(1f)
                .height(180.dp)
                .background(Color(0xFFFFCDD2), RoundedCornerShape(12.dp))
        )
        Box(
            modifier = Modifier
                .weight(1f)
                .height(180.dp)
                .background(Color(0xFF81D4FA), RoundedCornerShape(12.dp))
        )
    }
}

@Composable
fun OfferTitle() {
    Column {
        Text(
            text = "Buy 1 items, Get extra 10% off",
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.PrimaryText
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Get Extra 10% off on mcaffine Bodywash, lotion and many more.",
            fontSize = 14.sp,
            color = AppColors.SecondaryText,
            lineHeight = 20.sp
        )
    }
}

@Composable
fun CouponCodeCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFE8DCFF)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "••••••••••••",
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                color = AppColors.PrimaryText,
                letterSpacing = 2.sp
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.FavoriteBorder,
                    contentDescription = "Copy",
                    tint = Color(0xFF5B4CFF),
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = "Copy Code",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF5B4CFF)
                )
            }
        }
    }
}

@Composable
fun TabRow(
    selectedTab: Int, tabs: List<String>, onTabSelected: (Int) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        tabs.forEachIndexed { index, tab ->
            Button(
                onClick = { onTabSelected(index) }, colors = ButtonDefaults.buttonColors(
                    containerColor = if (selectedTab == index) Color(0xFF5B4CFF) else Color(
                        0xFFE0E0E0
                    ),
                    contentColor = if (selectedTab == index) Color.White else AppColors.SecondaryText
                ), shape = RoundedCornerShape(20.dp), modifier = Modifier.wrapContentWidth()
            ) {
                Text(
                    text = tab, fontSize = 13.sp, fontWeight = FontWeight.Normal
                )
            }
        }
    }
}

@Composable
fun DetailsContent() {
    Column {
        Text(
            text = "Details",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.PrimaryText
        )
        Spacer(modifier = Modifier.height(12.dp))
        BulletPoint("Expires on December 29, 2025")
        BulletPoint("Flat ₹200 off on minimum order of ₹999")
        BulletPoint("Free shipping on all eligible orders")
        BulletPoint("Extra 10% off on prepaid payments")
        BulletPoint("Add items to cart & apply the code at checkout to claim the offer")
    }
}

@Composable
fun HowToRedeemContent() {
    Column {
        Text(
            text = "How to redeem",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.PrimaryText
        )
        Spacer(modifier = Modifier.height(12.dp))
        NumberedPoint(1, "Copy the coupon code.")
        NumberedPoint(2, "Go to the partner app/website.")
        NumberedPoint(3, "Add items to cart and apply the code at checkout.")
        NumberedPoint(4, "Complete payment to claim the offer.")
    }
}

@Composable
fun TermsAndConditionsContent() {
    Column {
        Text(
            text = "Terms & conditions",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.PrimaryText
        )
        Spacer(modifier = Modifier.height(12.dp))
        BulletPoint("Valid for a limited time only.")
        BulletPoint("One-time use per user.")
        BulletPoint("Cannot be combined with other offers.")
        BulletPoint("Minimum order value may apply.")
        BulletPoint("Partner can modify or cancel the offer anytime.")
    }
}

@Composable
fun BulletPoint(text: String) {
    Row(
        modifier = Modifier.padding(vertical = 4.dp)
    ) {
        Text(
            text = "• ", fontSize = 14.sp, color = AppColors.PrimaryText
        )
        Text(
            text = text, fontSize = 14.sp, color = AppColors.SecondaryText, lineHeight = 20.sp
        )
    }
}

@Composable
fun NumberedPoint(number: Int, text: String) {
    Row(
        modifier = Modifier.padding(vertical = 4.dp)
    ) {
        Text(
            text = "$number. ",
            fontSize = 14.sp,
            color = AppColors.PrimaryText,
            fontWeight = FontWeight.Medium
        )
        Text(
            text = text, fontSize = 14.sp, color = AppColors.SecondaryText, lineHeight = 20.sp
        )
    }
}

@Composable
fun BottomActionButtons() {
    Surface(
        modifier = Modifier.fillMaxWidth(), color = AppColors.CardBackground, shadowElevation = 8.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = { /* Handle Redeemed */ },
                modifier = Modifier
                    .weight(1f)
                    .height(50.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = AppColors.PrimaryText
                )
            ) {
                Text(
                    text = "Redeemed", fontSize = 16.sp, fontWeight = FontWeight.Medium
                )
            }

            Button(
                onClick = { /* Handle Discover */ },
                modifier = Modifier
                    .weight(1f)
                    .height(50.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF5B4CFF)
                )
            ) {
                Text(
                    text = "Discover",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White
                )
            }
        }
    }
}
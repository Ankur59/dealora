package com.ayaan.dealora.ui.presentation.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.ui.presentation.navigation.navbar.AppTopBar
import com.ayaan.dealora.ui.theme.*
import com.ayaan.dealora.R
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    navController: NavController,
    viewModel: HomeViewModel = hiltViewModel()
) {
    Scaffold(
        topBar = { AppTopBar(navController) },
        contentWindowInsets = WindowInsets(0),
        containerColor = DealoraBackground
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
        ) {
            Spacer(modifier = Modifier.height(24.dp))

            // Welcome Text
            val welcomeText = buildAnnotatedString {
                append("Hey, ")
                withStyle(style = SpanStyle(color = DealoraPrimary, fontWeight = FontWeight.Bold)) {
                    append("Ayaan")
                }
            }
            Text(
                text = welcomeText,
                fontSize = 28.sp,
                fontWeight = FontWeight.W400
            )

            Text(
                text = "Your smart savings dashboard is ready.",
                fontSize = 14.sp,
                color = DealoraTextGray,
                modifier = Modifier.padding(top = 4.dp)
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Search Bar
            OutlinedTextField(
                value = "",
                onValueChange = {},
                placeholder = {
                    Text(
                        "Search Coupons",
                        color = DealoraTextGray,
                        fontSize = 14.sp
                    )
                },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search",
                        tint = DealoraTextGray
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedContainerColor = DealoraWhite,
                    focusedContainerColor = DealoraWhite,
                    unfocusedBorderColor = Color(0xFFE0E0E0),
                    focusedBorderColor = DealoraPrimary
                )
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Coupons Card
            CouponsCard()

            Spacer(modifier = Modifier.height(20.dp))

            // Sync Apps Card
//            SyncAppsCard()
            Image(
                painter = painterResource(id = R.drawable.sync_banner),
                contentDescription = "Sync Apps",
                modifier = Modifier.fillMaxWidth().height(180.dp)
            )
            Spacer(modifier = Modifier.height(24.dp))

            // Explore Category
            Text(
                text = "Explore Category",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Category Grid
            CategoryGrid()

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
fun CouponsCard() {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(140.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = DealoraPrimary)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Active Coupons Section
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Image(
                        painter = painterResource(R.drawable.save_60),
                        contentDescription = null,
                        modifier = Modifier.size(36.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Your Active Coupons",
                        fontSize = 12.sp,
                        color = DealoraWhite,
                        fontWeight = FontWeight.W500
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CouponDigit("0")
                    Spacer(modifier = Modifier.width(4.dp))
                    CouponDigit("0")
                }
            }

            // Vertical Divider
            Box(
                modifier = Modifier
                    .width(2.dp)
                    .height(80.dp)
                    .background(
                        Color.White.copy(alpha = 0.3f),
                        RoundedCornerShape(1.dp)
                    )
            )

            // Savings Section
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Search, // Use coin icon if available
                        contentDescription = "Savings",
                        tint = Color(0xFFFFD700),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Your Coupons Saving",
                        fontSize = 12.sp,
                        color = DealoraWhite,
                        fontWeight = FontWeight.W500
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "₹",
                        fontSize = 20.sp,
                        color = DealoraWhite,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    CouponDigit("0")
                    Spacer(modifier = Modifier.width(4.dp))
                    CouponDigit("0")
                    Spacer(modifier = Modifier.width(4.dp))
                    CouponDigit("0")
                }
            }
        }
    }
}

@Composable
fun CouponDigit(digit: String) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .background(DealoraWhite.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
            .border(1.dp, DealoraWhite.copy(alpha = 0.3f), RoundedCornerShape(8.dp)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = digit,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = DealoraWhite
        )
    }
}

@Composable
fun SyncAppsCard() {
    Card(
        modifier = Modifier
            .fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFE8E8E8))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Illustration placeholder
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .background(Color(0xFFD0D0D0), RoundedCornerShape(12.dp))
            )

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Sync Your Apps,",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Unlock Every ",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Black
                    )
                    Text(
                        text = "Deal",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = DealoraPrimary
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    BulletPoint("Organize all your earned deals automatically")
                    BulletPoint("Track expiry & get timely reminders")
                    BulletPoint("Never miss a savings opportunity again")
                }

                Spacer(modifier = Modifier.height(12.dp))

                Button(
                    onClick = {},
                    colors = ButtonDefaults.buttonColors(containerColor = DealoraPrimary),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.height(40.dp)
                ) {
                    Text(
                        text = "Sync My Apps",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
fun BulletPoint(text: String) {
    Row(verticalAlignment = Alignment.Top) {
        Text(
            text = "•",
            fontSize = 12.sp,
            color = Color.Black,
            modifier = Modifier.padding(end = 6.dp)
        )
        Text(
            text = text,
            fontSize = 11.sp,
            color = Color.Black.copy(alpha = 0.7f)
        )
    }
}

@Composable
fun CategoryGrid() {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            CategoryItem("Food", Color(0xFFE74C3C), "🍴")
            CategoryItem("Fashion", Color(0xFF95A5A6), "👔")
            CategoryItem("Grocery", Color(0xFF16A085), "🍉")
            CategoryItem("Wallet Rewards", Color(0xFFD4A574), "💳")
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            CategoryItem("Beauty", Color(0xFFE91E63), "💄")
            CategoryItem("Travel", Color(0xFFF39C12), "🎒")
            CategoryItem("Entertainment", Color(0xFF5F7C8A), "🎬")
            CategoryItem("See All", DealoraPrimary, "", isSeeAll = true)
        }
    }
}

@Composable
fun CategoryItem(
    name: String,
    color: Color,
    emoji: String,
    isSeeAll: Boolean = false
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(80.dp)
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(color),
            contentAlignment = Alignment.Center
        ) {
            if (isSeeAll) {
                Text(
                    text = "See All",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = DealoraWhite,
                    textAlign = TextAlign.Center
                )
            } else {
                Text(
                    text = emoji,
                    fontSize = 28.sp
                )
            }
        }
        if (!isSeeAll) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = name,
                fontSize = 12.sp,
                color = Color.Black,
                textAlign = TextAlign.Center,
                fontWeight = FontWeight.W500
            )
        }
    }
}
package com.ayaan.dealora.ui.presentation.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.presentation.home.components.CategoryGrid
import com.ayaan.dealora.ui.presentation.home.components.CouponDigit
import com.ayaan.dealora.ui.presentation.navigation.navbar.AppTopBar
import com.ayaan.dealora.ui.presentation.navigation.navbar.DealoraBottomBar
import com.ayaan.dealora.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    navController: NavController, viewModel: HomeViewModel = hiltViewModel()
) {
    Scaffold(
        topBar = {
            AppTopBar(navController)
        },
        contentWindowInsets = WindowInsets(0),
        containerColor = DealoraBackground,
        floatingActionButton = {
            DealoraBottomBar(
                navController = navController
            )
        },
        floatingActionButtonPosition = FabPosition.Center
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
                text = welcomeText, fontSize = 28.sp, fontWeight = FontWeight.W400
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
                        "Search Coupons", color = DealoraTextGray, fontSize = 14.sp
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
            Image(
                painter = painterResource(id = R.drawable.sync_banner),
                contentDescription = "Sync Apps",
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
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

            Spacer(modifier = Modifier.height(120.dp))
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
                horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)
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
                        Color.White.copy(alpha = 0.3f), RoundedCornerShape(1.dp)
                    )
            )

            // Savings Section
            Column(
                horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
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



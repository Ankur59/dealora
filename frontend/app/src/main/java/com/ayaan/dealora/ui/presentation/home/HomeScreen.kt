package com.ayaan.dealora.ui.presentation.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.presentation.home.components.CategoryGrid
import com.ayaan.dealora.ui.presentation.home.components.CouponDigit
import com.ayaan.dealora.ui.presentation.home.components.CouponsCard
import com.ayaan.dealora.ui.presentation.home.components.ExploringCoupons
import com.ayaan.dealora.ui.presentation.home.components.SearchBar
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

            SearchBar()

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
            Spacer(modifier = Modifier.height(24.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 2.dp, end = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Explore Coupons",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )
                Text(
                    text = "See all",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.W600,
                    color = DealoraPrimary,
                    textDecoration = TextDecoration.Underline,
                    modifier = Modifier.clickable(onClick = {})
                )
            }
            ExploringCoupons(navController)
            Spacer(modifier = Modifier.height(120.dp))
        }
    }
}



package com.ayaan.dealora.ui.presentation.home.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.theme.DealoraWhite

@Composable
fun CategoryGrid(navController: NavController) {
    var isExpanded by remember { mutableStateOf(false) }

    val allCategories = listOf(
        "Food" to R.drawable.category_food,
        "Fashion" to R.drawable.category_fashion,
        "Grocery" to R.drawable.category_grocery,
        "Wallet Rewards" to R.drawable.category_wallet,
        "Beauty" to R.drawable.category_beauty,
        "Travel" to R.drawable.category_travel,
        "Entertainment" to R.drawable.category_entertainment,
        "Other" to R.drawable.category_other,
        "Electronics" to R.drawable.category_electronics,
        "Health" to R.drawable.category_health,
        "Home" to R.drawable.category_home,
        "Education" to R.drawable.category_education
    )

    val displayItems = if (isExpanded) {
        allCategories.map { it to false } + (("See Less" to 0) to true)
    } else {
        allCategories.take(7).map { it to false } + (("See All" to 0) to true)
    }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        displayItems.chunked(4).forEach { rowItems ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                rowItems.forEach { (item, isAction) ->
                    val (name, imageRes) = item
                    if (isAction) {
                        CategoryItemAction(name, onClick = { isExpanded = !isExpanded })
                    } else {
                        CategoryItem(name, imageRes, navController)
                    }
                }
                
                if (rowItems.size < 4) {
                    repeat(4 - rowItems.size) {
                        Spacer(modifier = Modifier.width(80.dp))
                    }
                }
            }
        }
    }
}

@Composable
fun CategoryItem(
    name: String,
    imageRes: Int,
    navController: NavController
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(80.dp)
            .clickable {
                navController.navigate(Route.ExploreCoupons.createRoute(category = name))
            }
    ) {
        Image(
            painter = painterResource(id = imageRes),
            contentDescription = name,
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = name,
            fontSize = 12.sp,
            color = Color.Black,
            textAlign = TextAlign.Center,
            fontWeight = FontWeight.W500,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
fun CategoryItemAction(text: String, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(80.dp)
            .clickable { onClick() }
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(DealoraPrimary),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = text,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = DealoraWhite,
                textAlign = TextAlign.Center
            )
        }
    }
}
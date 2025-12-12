package com.ayaan.dealora.ui.presentation.navigation.navbar

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.ui.theme.BottomBarBackground
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.theme.DealoraTextGray

@Composable
fun DealoraBottomBar(
    selectedIndex: Int = 1,
    navController: NavController
) {
    val items = listOf(
        BottomBarItem(R.drawable.dashboard_48, "Dashboard", {}),
        BottomBarItem(R.drawable.add_coupon_48, "Add Coupon",{navController.navigate(Route.AddCoupon.path)}),
        BottomBarItem(R.drawable.redeemed_coupon_48, "Redeemed\nCoupons",{})
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 24.dp),
        contentAlignment = Alignment.BottomCenter
    ) {
        Row(
            modifier = Modifier
                .width(320.dp)
                .height(80.dp)
                .background(
                    color = BottomBarBackground, shape = RoundedCornerShape(40.dp)
                )
                .padding(horizontal = 24.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            items.forEachIndexed { index, item ->
                BottomBarIcon(
                    item = item,
                    isSelected = index == selectedIndex,
                    isCenter = index == 1,
                    onClick = { item.onClick() })
            }
        }
    }
}

@Composable
fun BottomBarIcon(
    item: BottomBarItem, isSelected: Boolean, isCenter: Boolean, onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier
            .width(72.dp)
            .padding(0.dp)
            .clickable { onClick() },
    ) {
        Box(
            modifier = if (isCenter) {
                Modifier
                    .size(44.dp)
                    .background(color = DealoraPrimary, shape = CircleShape)
                    .border(
                        width = 2.dp, color = DealoraPrimary, shape = CircleShape
                    )
            } else {
                Modifier.size(32.dp)
            },
            contentAlignment = Alignment.Center,
        ) {
            Image(
                painter = painterResource(id = item.resourceId),
                contentDescription = item.label,
                modifier = Modifier.size(if (isCenter) 24.dp else 22.dp),
            )
        }
        Text(
            text = item.label,
            fontSize = 10.sp,
            fontWeight = if (isSelected || isCenter) FontWeight.SemiBold else FontWeight.Normal,
            color = if (isSelected || isCenter) DealoraPrimary else DealoraTextGray,
            lineHeight = 12.sp,
            maxLines = 2,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(0.dp)
        )
    }
}

data class BottomBarItem(
    val resourceId: Int, val label: String, val onClick: () -> Unit={}
)

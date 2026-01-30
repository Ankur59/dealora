package com.ayaan.dealora.ui.presentation.home.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.theme.*

@Composable
fun StatisticsCard(
    activeCouponsCount: Int = 0,
    totalSavings: Int = 0
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .wrapContentHeight(), // Changed from fixed height to wrap content
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = DealoraPrimary)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp), // Consistent outer padding
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceEvenly // Ensures equal spacing
        ) {

            // ================= ACTIVE COUPONS =================
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp), // Consistent horizontal padding
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp) // Consistent vertical spacing
            ) {

                // TEXT ROW — Icon + Label
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Image(
                        painter = painterResource(R.drawable.save_60),
                        contentDescription = null,
                        modifier = Modifier.size(24.dp) // Fixed icon size
                    )

                    Spacer(modifier = Modifier.width(6.dp)) // Fixed spacing

                    Text(
                        text = "Your Active\nCoupons",
                        fontSize = 11.sp, // Slightly reduced for better fit
                        color = DealoraWhite,
                        fontWeight = FontWeight.W500,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        lineHeight = 13.sp,
                        textAlign = TextAlign.Center
                    )
                }

                // DIGIT BOXES — Fixed size boxes
                val couponStr = activeCouponsCount
                    .toString()
                    .padStart(2, '0')

                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    couponStr.forEachIndexed { index, char ->
                        CouponDigit(char.toString())
                        if (index < couponStr.length - 1) {
                            Spacer(modifier = Modifier.width(6.dp)) // Fixed spacing between boxes
                        }
                    }
                }
            }


            // ================= DIVIDER =================
            Box(
                modifier = Modifier
                    .width(1.5.dp) // Slightly thinner divider
                    .height(100.dp) // Fixed divider height
                    .background(
                        Color.White.copy(alpha = 0.3f),
                        RoundedCornerShape(1.dp)
                    )
            )

            // ================= SAVINGS =================
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp), // Consistent horizontal padding
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp) // Consistent vertical spacing
            ) {

                // TEXT ROW — Icon + Label
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                        tint = Color(0xFFFFD700),
                        modifier = Modifier.size(20.dp) // Fixed icon size
                    )

                    Spacer(modifier = Modifier.width(6.dp)) // Fixed spacing

                    Text(
                        text = "Amount you\ncan save",
                        fontSize = 11.sp, // Slightly reduced for better fit
                        color = DealoraWhite,
                        fontWeight = FontWeight.W500,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        lineHeight = 13.sp,
                        textAlign = TextAlign.Center
                    )
                }

                // SAVINGS AMOUNT — ₹ symbol + digit boxes
                val savingsStr = totalSavings
                    .toString()
                    .padStart(3, '0')

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {

                    // ₹ Symbol — Fixed size
                    Text(
                        text = "₹",
                        fontSize = 22.sp, // Fixed font size
                        fontWeight = FontWeight.Bold,
                        color = DealoraWhite
                    )

                    Spacer(modifier = Modifier.width(4.dp)) // Fixed spacing

                    // Digit boxes
                    savingsStr.forEachIndexed { index, char ->
                        CouponDigit(char.toString())
                        if (index < savingsStr.length - 1) {
                            Spacer(modifier = Modifier.width(6.dp)) // Fixed spacing between boxes
                        }
                    }
                }
            }
        }
    }
}
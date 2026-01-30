package com.ayaan.dealora.ui.presentation.home.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.Arrangement
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
            .height(140.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = DealoraPrimary)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {

            // ================= ACTIVE COUPONS =================
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {

                // TEXT ROW — stays fixed
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Image(
                        painter = painterResource(R.drawable.save_60),
                        contentDescription = null,
                        modifier = Modifier.size(30.dp)
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    Text(
                        text = "Your Active Coupons",
                        fontSize = 12.sp,
                        color = DealoraWhite,
                        fontWeight = FontWeight.W500,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        lineHeight = 14.sp
                    )
                }

                // BOXES — move independently
                val couponStr = activeCouponsCount
                    .toString()
                    .padStart(2, '0')

                Row(
                    modifier = Modifier.padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    couponStr.forEachIndexed { index, char ->
                        CouponDigit(char.toString())
                        if (index < couponStr.length - 1) {
                            Spacer(modifier = Modifier.width(6.dp))
                        }
                    }
                }
            }


            // ================= DIVIDER =================
            Box(
                modifier = Modifier
                    .width(2.dp)
                    .height(80.dp)
                    .background(
                        Color.White.copy(alpha = 0.3f),
                        RoundedCornerShape(1.dp)
                    )
            )

            // ================= SAVINGS =================
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {

                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                        tint = Color(0xFFFFD700),
                        modifier = Modifier.size(20.dp)
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    Text(
                        text = "Amount you can save",
                        fontSize = 12.sp,
                        color = DealoraWhite,
                        fontWeight = FontWeight.W500,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        lineHeight = 14.sp
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                val savingsStr = totalSavings
                    .toString()
                    .padStart(3, '0')

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {

                    // ₹ aligned perfectly
                    Box(
//                        modifier = Modifier.size(40.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "  ₹ ",
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            color = DealoraWhite
                        )
                    }

//                    Spacer(modifier = Modifier.width(6.dp))

                    savingsStr.forEachIndexed { index, char ->
                        CouponDigit(char.toString())
                        if (index < savingsStr.length - 1) {
                            Spacer(modifier = Modifier.width(6.dp))
                        }
                    }
                }
            }
        }
    }
}
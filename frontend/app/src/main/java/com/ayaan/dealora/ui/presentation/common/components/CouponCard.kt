package com.ayaan.dealora.ui.presentation.common.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun CouponCard(
    onDetailsClick: () -> Unit = {}
) {
    var isRedeemed by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
        ) {
            // Top Purple Section
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF5B3FD9))
                    .padding(20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Logo
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .background(Color(0xFF1E88A8), CircleShape)
                            .padding(12.dp), contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "BOMBAY\nSHAVING\nCOMPANY",
                            color = Color.White,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            lineHeight = 10.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }

                    // Title and Info
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 16.dp)
                    ) {
                        Text(
                            text = "Buy 1 items, Get extra 10% off",
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Chip(text = "Beauty")
                            Chip(text = "Expiry by 23 days")
                        }
                    }

                    // Bookmark Icon
                    IconButton(onClick = {}) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = "Bookmark",
                            tint = Color.White,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }
            }

            // Divider with circles
//            Box(
//                modifier = Modifier
//                    .fillMaxWidth()
//                    .height(30.dp)
//            ) {
//                Canvas(modifier = Modifier.fillMaxSize()) {
//                    val circleRadius = 15.dp.toPx()
//                    val spacing = size.width / 20
//
//                    // Draw the background
//                    drawRect(Color(0xFFE5E5E5))
//
//                    // Draw semi-circles on left and right
//                    drawCircle(
//                        color = Color.White,
//                        radius = circleRadius,
//                        center = Offset(-circleRadius, size.height / 2)
//                    )
//                    drawCircle(
//                        color = Color.White,
//                        radius = circleRadius,
//                        center = Offset(size.width + circleRadius, size.height / 2)
//                    )
//
//                    // Draw dashed line
//                    for (i in 0..19) {
//                        drawCircle(
//                            color = Color.White,
//                            radius = 3.dp.toPx(),
//                            center = Offset(spacing * i, size.height / 2)
//                        )
//                    }
//                }
//            }

            // Bottom Gray Section
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFE5E5E5))
                    .padding(20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Get Extra 10% off on mcaffine Bodywash, lotion and many more.",
                        fontSize = 16.sp,
                        color = Color(0xFF333333),
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 60.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    TextButton(
                        onClick = onDetailsClick, modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = "Details", fontSize = 16.sp, fontWeight = FontWeight.SemiBold
                        )
                    }

                    OutlinedButton(
                        onClick = { isRedeemed = true },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = if (isRedeemed) Color.LightGray else Color.White
                        ),
                        enabled = !isRedeemed
                    ) {
                        Text(
                            text = if (isRedeemed) "Redeemed" else "Redeemed",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF666666)
                        )
                    }

                    Button(
                        onClick = {},
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF5B3FD9)
                        )
                    ) {
                        Text(
                            text = "Discover", fontSize = 16.sp, fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun Chip(text: String) {
    Box(
        modifier = Modifier
            .background(Color(0x40FFFFFF), RoundedCornerShape(16.dp))
            .padding(horizontal = 2.dp, vertical = 6.dp)
    ) {
        Text(
            text = text, color = Color.White, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.MiddleEllipsis
        )
    }
}

@Preview
@Composable
fun CouponCardPreview() {
    CouponCard()
}
package com.ayaan.dealora.ui.presentation.couponsList.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.data.api.models.CouponListItem
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.utils.Base64ImageUtils

/**
 * Composable for displaying a single coupon item with base64 image
 */
@Composable
fun CouponListItemCard(
    coupon: CouponListItem,
    modifier: Modifier = Modifier,
    navController: NavController
) {
    // Decode base64 image, remember it to avoid re-decoding on recomposition
    val imageBitmap: ImageBitmap? = remember(coupon.couponImageBase64) {
        if (!coupon.couponImageBase64.isNullOrBlank()) {
            try {
                val bitmap = Base64ImageUtils.decodeBase64ToImageBitmap(coupon.couponImageBase64)
                // Check if it's a valid bitmap (not the 1x1 fallback)
                if (bitmap.width > 1 && bitmap.height > 1) bitmap else null
            } catch (e: Exception) {
                null
            }
        } else {
            null
        }
    }
    if (imageBitmap != null) {
        // Display decoded base64 image - edge-to-edge, no padding
        Image(
            bitmap = imageBitmap,
            contentDescription = coupon.couponTitle ?: "Coupon",
            contentScale = ContentScale.FillWidth,
            modifier = modifier.fillMaxWidth().clickable{
                navController.navigate(Route.CouponDetails.createRoute(coupon.id))
            }
        )
    } else {
        // Fallback to static image if base64 decoding fails - edge-to-edge, no padding
        Image(
            painter = painterResource(R.drawable.coupon_filled),
            contentDescription = coupon.couponTitle ?: "Coupon",
            contentScale = ContentScale.FillWidth,
            modifier = modifier.fillMaxWidth()
        )
    }
}


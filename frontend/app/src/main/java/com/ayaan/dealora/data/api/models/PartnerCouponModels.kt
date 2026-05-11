package com.ayaan.dealora.data.api.models

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Paginated list response for GET /api/partner-coupons and GET /api/partner-coupons/redeemed */
@JsonClass(generateAdapter = true)
data class PartnerCouponListResponseData(
    @Json(name = "total")   val total: Int,
    @Json(name = "page")    val page: Int,
    @Json(name = "pages")   val pages: Int,
    @Json(name = "count")   val count: Int,
    @Json(name = "limit")   val limit: Int,
    @Json(name = "coupons") val coupons: List<PartnerCoupon>
)

/** A single partner coupon shaped by partnerCouponController on the Backend. */
@JsonClass(generateAdapter = true)
data class PartnerCoupon(
    @Json(name = "_id")             val id: String,
    @Json(name = "couponId")        val couponId: String?       = null,
    @Json(name = "partner")         val partner: String?        = null,
    @Json(name = "brandName")       val brandName: String,
    @Json(name = "couponTitle")     val couponTitle: String?    = null,
    @Json(name = "description")     val description: String?    = null,
    @Json(name = "couponCode")      val couponCode: String?     = null,
    @Json(name = "discount")        val discount: String?       = null,
    @Json(name = "discountWeight")  val discountWeight: Double? = null,
    @Json(name = "category")        val category: String?       = null,
    @Json(name = "categories")      val categories: List<String> = emptyList(),
    /** trackingLink / couponVisitingLink — used for the Discover button */
    @Json(name = "couponLink")      val couponLink: String?     = null,
    @Json(name = "expiryDate")      val expiryDate: String?     = null,
    @Json(name = "daysUntilExpiry") val daysUntilExpiry: Int?   = null,
    @Json(name = "isExpired")       val isExpired: Boolean?     = false,
    @Json(name = "isRedeemed")      val isRedeemed: Boolean?    = false,
    @Json(name = "redeemedAt")      val redeemedAt: String?     = null,
    @Json(name = "merchantName")    val merchantName: String?   = null,
    @Json(name = "merchantLogo")    val merchantLogo: String?   = null,
    @Json(name = "couponType")      val couponType: String?     = null,
    @Json(name = "isInStore")       val isInStore: Boolean?     = false,
    @Json(name = "isNewUser")       val isNewUser: Boolean?     = false,
    @Json(name = "isVerified")      val isVerified: Boolean?    = false,
    @Json(name = "createdAt")       val createdAt: String?      = null,
    @Json(name = "updatedAt")       val updatedAt: String?      = null,
)

/** Response for POST /api/partner-coupons/:id/redeem */
@JsonClass(generateAdapter = true)
data class PartnerCouponRedeemResponseData(
    @Json(name = "redemption") val redemption: RedemptionEntry,
    @Json(name = "coupon")     val coupon: PartnerCoupon
)

@JsonClass(generateAdapter = true)
data class RedemptionEntry(
    @Json(name = "_id")        val id: String,
    @Json(name = "userId")     val userId: String,
    @Json(name = "couponId")   val couponId: String,
    @Json(name = "redeemedAt") val redeemedAt: String
)

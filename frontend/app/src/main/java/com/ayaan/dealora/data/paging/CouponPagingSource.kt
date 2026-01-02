package com.ayaan.dealora.data.paging

import android.util.Log
import androidx.paging.PagingSource
import androidx.paging.PagingState
import com.ayaan.dealora.data.api.CouponApiService
import com.ayaan.dealora.data.api.models.CouponListItem
import retrofit2.HttpException
import java.io.IOException

/**
 * PagingSource for loading coupons with pagination
 */
class CouponPagingSource(
    private val couponApiService: CouponApiService,
    private val uid: String,
    private val status: String = "active",
    private val brand: String? = null,
    private val category: String? = null,
    private val discountType: String? = null
) : PagingSource<Int, CouponListItem>() {

    companion object {
        private const val TAG = "CouponPagingSource"
        private const val STARTING_PAGE = 1
        const val PAGE_SIZE = 5
    }

    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, CouponListItem> {
        val page = params.key ?: STARTING_PAGE

        return try {
            Log.d(TAG, "Loading page $page with limit ${params.loadSize}")

            val response = couponApiService.getCoupons(
                uid = uid,
                page = page,
                limit = params.loadSize,
                status = status,
                brand = brand,
                category = category,
                discountType = discountType
            )

            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true && body.data != null) {
                    val coupons = body.data.coupons
                    val total = body.data.total
                    val currentPage = body.data.page
                    val limit = body.data.limit

                    Log.d(TAG, "Loaded ${coupons.size} coupons. Total: $total, Page: $currentPage")

                    // Calculate if there's a next page
                    val hasNextPage = (currentPage * limit) < total

                    LoadResult.Page(
                        data = coupons,
                        prevKey = if (page == STARTING_PAGE) null else page - 1,
                        nextKey = if (hasNextPage) page + 1 else null
                    )
                } else {
                    val errorMessage = body?.message ?: "Failed to load coupons"
                    Log.e(TAG, "API error: $errorMessage")
                    LoadResult.Error(Exception(errorMessage))
                }
            } else {
                val errorCode = response.code()
                val errorMessage = when (errorCode) {
                    401 -> "Session expired. Please login again."
                    403 -> "You don't have permission to view coupons."
                    404 -> "Coupons not found."
                    500 -> "Server error. Please try again later."
                    else -> "Something went wrong. Please try again."
                }
                Log.e(TAG, "HTTP error $errorCode: ${response.message()}")
                LoadResult.Error(Exception(errorMessage))
            }
        } catch (e: IOException) {
            Log.e(TAG, "Network error", e)
            LoadResult.Error(Exception("Unable to connect. Please check your internet connection."))
        } catch (e: HttpException) {
            Log.e(TAG, "HTTP exception", e)
            LoadResult.Error(Exception("Something went wrong. Please try again."))
        } catch (e: Exception) {
            Log.e(TAG, "Unknown error", e)
            LoadResult.Error(Exception("An unexpected error occurred. Please try again."))
        }
    }

    override fun getRefreshKey(state: PagingState<Int, CouponListItem>): Int? {
        return state.anchorPosition?.let { anchorPosition ->
            state.closestPageToPosition(anchorPosition)?.prevKey?.plus(1)
                ?: state.closestPageToPosition(anchorPosition)?.nextKey?.minus(1)
        }
    }
}


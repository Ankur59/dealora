package com.ayaan.dealora.data.util

object CategoryMapper {
    private val CATEGORY_MAP = mapOf(
        "Food" to listOf(
            "food and dining",
            "bakeries",
            "cookies",
            "pizza",
            "restaurants",
            "fast food"
        ),
        "Fashion" to listOf(
            "fashion and accessories",
            "topwear",
            "bottomwear",
            "blazers, waistcoats and suits",
            "jewellery",
            "winterwear",
            "ethnicwear",
            "inner wear and loungewear",
            "raincoats and windcheaters",
            "footwear",
            "watch",
            "wallets, belts and caps",
            "luggage and bags",
            "opticians",
            "baby fashion",
            "sportswear"
        ),
        "Grocery" to listOf(
            "grocery",
            "snacks and beverages",
            "cooking essentials",
            "dairy",
            "packaged foods",
            "meat",
            "vegetables"
        ),
        "Wallet Rewards" to listOf(
            "recharge and bill payment",
            "mobile recharge",
            "data card recharge",
            "dth recharge",
            "utility bills",
            "metro",
            "insurance",
            "fastag recharge",
            "gas payments",
            "water biil",
            "finance",
            "stock markets",
            "investment",
            "payment wallets",
            "bank",
            "payment cards"
        ),
        "Beauty" to listOf(
            "beauty and personal care",
            "cosmetics",
            "fragrance and perfume",
            "hair and makeup",
            "male grooming",
            "skincare",
            "bath and shower"
        ),
        "Travel" to listOf(
            "travels",
            "auto",
            "bus",
            "cab",
            "international flights",
            "domestic flights",
            "international hotels",
            "domestic hotels",
            "train",
            "car rentals",
            "car and motorbike",
            "vehicle servicing",
            "used vehicles",
            "electric vehicles",
            "new vehicles",
            "vehicle accessories"
        ),
        "Entertainment" to listOf(
            "movies and entertainment",
            "movie tickets",
            "theme parks",
            "streaming media",
            "gaming",
            "fantasy leagues",
            "indoor and outdoor games",
            "online games",
            "video games"
        ),
        "Electronics" to listOf(
            "electronics",
            "mobile",
            "mobile accessories",
            "pcs and laptops",
            "pcs and laptops accessories",
            "camera",
            "camera accessories",
            "ipads and tablets",
            "speakers and headphones",
            "network components",
            "gaming consoles",
            "gaming accessories"
        ),
        "Health" to listOf(
            "healthcare",
            "oral care",
            "sanitizers",
            "medicines and health check-ups",
            "sexual wellness",
            "sports and fitness",
            "fitness equipment",
            "supplements and health drinks",
            "sports equipment"
        ),
        "Home" to listOf(
            "home appliances",
            "kitchen appliances",
            "decor and furniture",
            "home furniture",
            "garden and outdoor",
            "towel",
            "bedsheet",
            "home decor",
            "lighting",
            "kitchen storage"
        ),
        "Education" to listOf(
            "books and stationery",
            "education and e-learning",
            "pens and attestation",
            "art and crafts",
            "notebook and dairies",
            "files and folders",
            "printing and papers",
            "newspapers and magazines",
            "office supplies",
            "books and novels",
            "ebooks",
            "audio books"
        ),
        "Other" to listOf(
            "baby care",
            "baby essentials",
            "toys and games",
            "diapers",
            "flowers, cakes and gifts",
            "cake",
            "flower",
            "gift card",
            "personalized gifts",
            "pet supplies",
            "pet cloths",
            "pet food",
            "it services",
            "software",
            "domain registration",
            "professional services",
            "web hosting",
            "industrial services",
            "industrial safety",
            "material handling",
            "tools and instruments",
            "other",
            "shopping sale",
            "festivals",
            "cities",
            "valentine's day"
        )
    )

    fun getSubcategories(appCategory: String?): String? {
        if (appCategory == null) return null
        val subcategoriesList = CATEGORY_MAP[appCategory] ?: return appCategory
        return subcategoriesList.joinToString(",")
    }
}

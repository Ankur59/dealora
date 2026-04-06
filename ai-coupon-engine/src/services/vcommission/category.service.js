// services/categoryService.js

import { Category } from "../../models/category.model.js";
import { getAllCategory } from "../../providers/trackier.js";

export const syncCategories = async () => {
    const data = await getAllCategory();

    const categories = data?.categories || [];

    for (const cat of categories) {
        await Category.findOneAndUpdate(
            { apiId: cat._id },
            {
                $setOnInsert: {
                    apiId: cat._id,
                    name: cat.name,
                    apiCreatedAt: cat.created,
                    apiUpdatedAt: cat.modified
                }
            },
            { upsert: true, new: true }
        );
    }
};
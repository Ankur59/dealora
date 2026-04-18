/**
 * Chunked Bulk Write
 *
 * Normalizes items, filters bad records, then writes to MongoDB via bulkWrite.
 * Handles duplicate key errors (code: 11000) gracefully — logs and continues.
 *
 * @param {Array}    items           — raw items from API
 * @param {Function} normalize       — (rawItem) => normalizedDoc | null
 * @param {Object}   Model           — Mongoose model to write to
 * @param {Function} getFilter       — (normalizedDoc) => MongoDB filter object
 * @param {boolean}  useSetOnInsert  — true = $setOnInsert (never overwrite), false = $set (always update)
 *
 * Usage:
 *   await bulkWriteChunked({
 *     items,
 *     normalize: normalizeCoupon,
 *     Model:     Coupon,
 *     getFilter: (n) => ({ partner: 'admitad', couponId: n.couponId }),
 *   });
 */
export const bulkWriteChunked = async ({
    items,
    normalize,
    Model,
    getFilter,
    useSetOnInsert = false,
}) => {
    if (!items?.length) return;

    const ops = items
        .map(item => {
            try {
                return normalize(item);
            } catch (err) {
                console.error(`[bulkWriteChunked] Normalizer threw for item ${JSON.stringify(item).slice(0, 80)}:`, err.message);
                return null;
            }
        })
        .filter(Boolean)
        .map(normalized => ({
            updateOne: {
                filter: getFilter(normalized),
                update: useSetOnInsert
                    ? { $setOnInsert: normalized }
                    : { $set:         normalized },
                upsert: true,
            },
        }));

    if (!ops.length) return;

    try {
        const result = await Model.bulkWrite(ops, { ordered: false });
        console.log(
            `[${Model.modelName}] ✓ ${ops.length} items — upserted: ${result.upsertedCount}, modified: ${result.modifiedCount}`
        );
        return result;
    } catch (err) {
        if (err.code === 11000) {
            // Duplicate unique key (e.g. two coupons share the same code) — non-fatal
            console.warn(`[${Model.modelName}] Duplicate key(s) skipped in batch.`);
            return null;
        }
        throw err;
    }
};

import Campaign from '../../models/campaign.model.js';

/**
 * Upserts a chunk of Admitad campaigns into the campaigns collection.
 * Uses $setOnInsert so existing records are never overwritten.
 *
 * @param {Array} campaigns - Array of raw campaign objects from Admitad chunk
 */
export const syncCampaignsAdmitad = async (campaigns) => {
    if (!campaigns || campaigns.length === 0) {
        return;
    }

    const operations = campaigns.map((camp) => ({
        updateOne: {
            filter: {
                partner:    'admitad',
                campaignId: String(camp.id),
            },
            update: {
                $setOnInsert: {
                    partner:      'admitad',
                    campaignId:   String(camp.id),
                    title:        camp.name ?? 'Unknown',
                    trackingLink: camp.site_url ?? null,
                    categories:   (camp.categories ?? []).map(c => c.name ?? c),
                    countries:    [],  
                    score:        0,
                    meta: {
                        status:   camp.status ?? null,
                        image:    camp.image  ?? null,
                        site_url: camp.site_url ?? null,
                    },
                },
            },
            upsert: true,
        },
    }));

    try {
        const result = await Campaign.bulkWrite(operations, { ordered: false });
        console.log(
            `[Admitad] Campaign Chunk Synced — inserted: ${result.upsertedCount}, matched: ${result.matchedCount}`
        );
        return result;
    } catch (err) {
        console.error('[Admitad] Bulk campaign write error:', err.message);
        throw err;
    }
};


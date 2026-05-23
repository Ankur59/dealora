/**
 * MerchantSync Service
 *
 * Bridges the gap between PartnerMerchant (source of truth from adapters:
 * vCommission, Coupomated, Admitad) and the internal Merchant collection
 * (used by Dashboard & browser automation).
 *
 * On every call to syncMerchants():
 *  1. Fetch all active PartnerMerchant records
 *  2. For each, try to find a matching internal Merchant (by name/domain)
 *  3. Auto-create missing Merchant records
 *  4. Update existing Merchant records with fresh metadata (website, domain)
 *  5. Optionally remove orphaned Merchant records that have zero matching
 *     PartnerMerchant and zero coupons/cookies/credentials
 */

import Merchant from '../models/merchant.model.js';
import PartnerMerchant from '../models/partnerMerchant.model.js';
import MerchantCredential from '../models/merchantCredential.model.js';

export function extractDomain(str) {
  if (!str) return '';
  let s = str.trim().toLowerCase();
  s = s.replace(/^(https?:\/\/)?(www\.)?/, '');
  s = s.split('/')[0];
  s = s.split(':')[0];
  return s;
}

export function cleanMerchantName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\.(com|in|co\.in|co\.th|net|org|edu|gov|co)$/, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function matchMerchant(internalM, partnerM) {
  if (!internalM || !partnerM) return false;

  if (internalM.merchantName && partnerM.merchantName &&
      internalM.merchantName.trim().toLowerCase() === partnerM.merchantName.trim().toLowerCase()) {
    return true;
  }

  const internalDom = extractDomain(internalM.domain || internalM.website || internalM.merchantName);
  const partnerDom = extractDomain(partnerM.domain || partnerM.website || partnerM.merchantName);
  if (internalDom && partnerDom && internalDom === partnerDom) {
    return true;
  }

  const internalClean = cleanMerchantName(internalM.merchantName);
  const partnerClean = cleanMerchantName(partnerM.merchantName);
  if (internalClean && partnerClean && internalClean === partnerClean) {
    return true;
  }

  return false;
}


class MerchantSyncService {

  /**
   * Full sync: ensure every active PartnerMerchant has a corresponding Merchant.
   * Returns { created, updated, orphans } counts.
   */
  async syncMerchants() {
    const partnerMerchants = await PartnerMerchant.find({ isActive: true }).lean();
    const allInternal = await Merchant.find({}).lean();

    let created = 0;
    let updated = 0;

    // Build a Set of internal Merchant _ids that got matched
    const matchedInternalIds = new Set();

    for (const pm of partnerMerchants) {
      const match = allInternal.find(im => matchMerchant(im, pm));

      if (match) {
        matchedInternalIds.add(match._id.toString());

        // Update internal Merchant with fresh metadata from partner if missing
        const updates = {};
        if (!match.website && pm.website) updates.website = pm.website;
        if (!match.domain && pm.domain) updates.domain = pm.domain;
        if (!match.merchantUrl && pm.affiliateLink) updates.merchantUrl = pm.affiliateLink;

        if (Object.keys(updates).length > 0) {
          await Merchant.findByIdAndUpdate(match._id, { $set: updates });
          updated++;
        }
      } else {
        // Auto-create internal Merchant from PartnerMerchant data
        try {
          const newMerchant = await Merchant.create({
            merchantName: pm.merchantName,
            status: 'active',
            isActive: true,
            website: pm.website || '',
            domain: pm.domain || extractDomain(pm.website || pm.merchantName),
            merchantUrl: pm.affiliateLink || '',
            description: `Auto-created from ${pm.partner} partner sync.`,
            autoVerificationEnabled: true,
          });
          matchedInternalIds.add(newMerchant._id.toString());
          created++;
          console.log(`[MerchantSync] Created internal Merchant: ${pm.merchantName} (from ${pm.partner})`);
        } catch (err) {
          // Likely duplicate name — skip
          if (err.code === 11000) {
            console.warn(`[MerchantSync] Duplicate name skipped: ${pm.merchantName}`);
          } else {
            console.error(`[MerchantSync] Failed to create Merchant for ${pm.merchantName}:`, err.message);
          }
        }
      }
    }

    // Find orphaned internal Merchants (no matching PartnerMerchant)
    const orphanIds = allInternal
      .filter(im => !matchedInternalIds.has(im._id.toString()))
      .map(im => im._id.toString());

    console.log(`[MerchantSync] Sync complete: created=${created}, updated=${updated}, orphans=${orphanIds.length}`);
    return { created, updated, orphanIds };
  }

  /**
   * Remove orphaned Merchant records that have:
   *  - No matching PartnerMerchant
   *  - No saved cookies
   *  - No credentials
   *  - No active automation state
   * Returns count of removed records.
   */
  async removeOrphans(orphanIds) {
    if (!orphanIds || orphanIds.length === 0) return 0;

    let removed = 0;
    for (const id of orphanIds) {
      const merchant = await Merchant.findById(id).lean();
      if (!merchant) continue;

      // Safety: don't remove if merchant has cookies, credentials, or active sessions
      const hasCookies = merchant.cookies && (
        Array.isArray(merchant.cookies) ? merchant.cookies.length > 0 : Object.keys(merchant.cookies).length > 0
      );
      const hasCredentials = await MerchantCredential.exists({ merchantId: id });
      const hasLoginAttempt = merchant.lastLoginAttempt?.status &&
        merchant.lastLoginAttempt.status !== 'idle';

      if (hasCookies || hasCredentials || hasLoginAttempt) {
        console.log(`[MerchantSync] Keeping orphan ${merchant.merchantName} — has cookies/creds/active state`);
        continue;
      }

      await Merchant.findByIdAndDelete(id);
      removed++;
      console.log(`[MerchantSync] Removed orphan: ${merchant.merchantName}`);
    }

    console.log(`[MerchantSync] Removed ${removed} orphaned merchants.`);
    return removed;
  }

  /**
   * Full sync + cleanup in one call.
   */
  async syncAndCleanup() {
    const result = await this.syncMerchants();
    const removed = await this.removeOrphans(result.orphanIds);
    return { ...result, removed };
  }
}

export default new MerchantSyncService();

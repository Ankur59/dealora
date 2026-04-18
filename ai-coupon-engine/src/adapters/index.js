/**
 * Adapter Registry
 *
 * This is the ONLY file to edit when adding a new partner.
 * ─────────────────────────────────────────────────────────
 * 1. Create src/adapters/[partnerName].adapter.js
 *    (copy from _template.adapter.js)
 * 2. Import it here and add it to the `adapters` map below.
 * Done.
 */

import vcommission from './vcommission.adapter.js';
import coupomated  from './coupomated.adapter.js';
import admitad     from './admitad.adapter.js';

export const adapters = {
    vcommission,
    coupomated,
    admitad,
};

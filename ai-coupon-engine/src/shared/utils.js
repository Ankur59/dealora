/**
 * Resolves a dot-path string against an object.
 * e.g. getNestedValue({ data: { count: 5 } }, 'data.count') → 5
 * Returns the object itself if path is empty/null.
 */
export const getNestedValue = (obj, path) => {
    if (!path || !obj) return obj;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

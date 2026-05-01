/**
 * API Key Auth Helper
 *
 * Creates a `getAuth` function that injects an API key into query params.
 * The key value is read from process.env at call time (not at module load),
 * so hot-reload and test overrides work correctly.
 *
 * Usage:
 *   const getAuth = apiKeyAuth({ envVar: 'COUPO_MATED_API_KEY', paramName: 'apikey' });
 *   const { headers, params } = await getAuth();
 *   // params → { apikey: 'Bp9XArUyRu6...' }
 *
 * @param {string} envVar   - Name of the environment variable holding the key
 * @param {string} paramName - Query parameter name the API expects (default: 'apikey')
 */
export const apiKeyAuth = ({ envVar, paramName = 'apikey' }) =>
    async () => ({
        headers: {},
        params:  { [paramName]: process.env[envVar] },
    });

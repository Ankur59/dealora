import express from 'express';
import { adminAuth } from '../middlewares/adminAuth.js';
import {
    getPartners, createPartner, deletePartner,
    getCredentials, createCredential, deleteCredential,
    getOffers, createOffer, deleteOffer,
    getResults, triggerValidation, getStats
} from '../controllers/validator.controller.js';

const router = express.Router();

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const envUsername = process.env.ADMIN_USERNAME;
    const envPassword = process.env.ADMIN_PASSWORD;

    if (!envUsername || !envPassword) {
        return res.status(500).json({ success: false, message: 'Admin credentials not configured.' });
    }

    if (username === envUsername && password === envPassword) {
            const token = Buffer.from(`${username}:${password}`).toString('base64');
        return res.status(200).json({ success: true, token });
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
});

router.use(adminAuth);

router.get('/stats', getStats);

router.get('/partners', getPartners);
router.post('/partners', createPartner);
router.delete('/partners/:id', deletePartner);

router.get('/credentials', getCredentials);
router.post('/credentials', createCredential);
router.delete('/credentials/:id', deleteCredential);

router.get('/offers', getOffers);
router.post('/offers', createOffer);
router.delete('/offers/:id', deleteOffer);

router.get('/results', getResults);
router.post('/run', triggerValidation);

export default router;

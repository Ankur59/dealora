import ValidatorPartner from "../models/validatorPartner.model.js";
import ValidatorCredential from "../models/validatorCredential.model.js";
import ValidatorOffer from "../models/validatorOffer.model.js";
import ValidationResult from "../models/validationResult.model.js";
import { runValidation } from "../services/validator.service.js";

export const getPartners = async (req, res) => {
    try {
        const partners = await ValidatorPartner.find();
        res.status(200).json({ success: true, data: partners });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const createPartner = async (req, res) => {
    try {
        const doc = await ValidatorPartner.create(req.body);
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

export const deletePartner = async (req, res) => {
    try {
        await ValidatorPartner.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const getCredentials = async (req, res) => {
    try {
        const creds = await ValidatorCredential.find();
        res.status(200).json({ success: true, data: creds });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const createCredential = async (req, res) => {
    try {
        const cred = await ValidatorCredential.findOneAndUpdate(
            { partnerName: req.body.partnerName },
            req.body,
            { upsert: true, new: true }
        );
        res.status(200).json({ success: true, data: cred });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

export const deleteCredential = async (req, res) => {
    try {
        await ValidatorCredential.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const getOffers = async (req, res) => {
    try {
        const offers = await ValidatorOffer.find();
        res.status(200).json({ success: true, data: offers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const createOffer = async (req, res) => {
    try {
        const offer = await ValidatorOffer.create(req.body);
        res.status(201).json({ success: true, data: offer });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

export const deleteOffer = async (req, res) => {
    try {
        await ValidatorOffer.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const getResults = async (req, res) => {
    try {
        const results = await ValidationResult.find().sort({ testedAt: -1 }).limit(100).populate('offerId');
        res.status(200).json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const triggerValidation = async (req, res) => {
    try {
        runValidation().catch(console.error);
        res.status(200).json({ success: true, message: 'Validation triggered in background.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const getStats = async (req, res) => {
    try {
        const totalPartners = await ValidatorPartner.countDocuments();
        const totalOffers = await ValidatorOffer.countDocuments();
        const validOffers = await ValidatorOffer.countDocuments({ lastStatus: 'VALID' });
        const invalidOffers = await ValidatorOffer.countDocuments({ lastStatus: 'INVALID' });

        res.status(200).json({ success: true, data: { totalPartners, totalOffers, validOffers, invalidOffers } });
    } catch(err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

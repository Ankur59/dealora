import { chromium } from "playwright";
import { GoogleGenAI } from "@google/genai";
import ValidatorPartner from "../models/validatorPartner.model.js";
import ValidatorCredential from "../models/validatorCredential.model.js";
import ValidatorOffer from "../models/validatorOffer.model.js";
import ValidationResult from "../models/validationResult.model.js";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getInteractables(page) {
    return await page.$$eval(
        'a, button, input, textarea, select, [role="button"]',
        els => els.map((el, index) => {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return null;
            let label = el.innerText || el.value || el.placeholder || el.name || el.id || el.getAttribute('aria-label') || '';
            label = label.trim().replace(/\s+/g, ' ').substring(0, 60);
            if (!label) return null;
            return {
                index: index,
                tag: el.tagName.toLowerCase(),
                type: el.type || '',
                label: label
            };
        }).filter(Boolean)
    );
}

async function performAgentAction(page, goal, logsArr) {
    const maxSteps = 12;
    for (let step = 0; step < maxSteps; step++) {
        await page.waitForLoadState('domcontentloaded');
        await new Promise(r => setTimeout(r, 2000));

        const interactables = await getInteractables(page);
        const pageTitle = await page.title();
        const currentUrl = page.url();

        const prompt = [
            "You are a web automation agent. Your current goal is:",
            goal,
            "",
            "Page title: " + pageTitle,
            "Page URL: " + currentUrl,
            "",
            "Here are the visible interactive elements on the page (each has an 'index' you can reference):",
            JSON.stringify(interactables.slice(0, 120)),
            "",
            "Pick the single best next action. Respond with ONLY a JSON object:",
            '{ "action": "click" or "type" or "done" or "fail", "index": <element index from the list>, "text": "<text to type, only if action is type>", "reason": "<brief explanation>" }',
            "",
            'Use "done" when the goal is achieved. Use "fail" if the goal cannot be achieved on this page.'
        ].join("\n");

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            });

            let rawText = response.text;
            const decision = JSON.parse(rawText);
            const logEntry = `[Step ${step + 1}] ${decision.action} | index: ${decision.index} | ${decision.reason}`;
            console.log("  " + logEntry);
            logsArr.push(logEntry);

            if (decision.action === 'done') return { success: true, steps: step + 1 };
            if (decision.action === 'fail') return { success: false, steps: step + 1 };

            const allHandles = await page.$$('a, button, input, textarea, select, [role="button"]');
            const targetElement = allHandles[decision.index];

            if (!targetElement) {
                console.log("  Agent picked an element index that doesn't exist, retrying...");
                logsArr.push("Agent picked an element index that doesn't exist, retrying...");
                continue;
            }

            if (decision.action === 'click') {
                await targetElement.click();
            } else if (decision.action === 'type') {
                await targetElement.fill('');
                await targetElement.type(decision.text, { delay: 40 });
            }
        } catch (err) {
            console.log("  Agent step error:", err.message);
            logsArr.push("Agent step error: " + err.message);
        }
    }
    logsArr.push("Hit max steps without finishing.");
    return { success: false, steps: maxSteps };
}

export const runValidation = async () => {
    console.log(`\nValidation run started at ${new Date().toISOString()}`);

    if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is not set. Skipping validation.");
        return { validated: 0, error: "GEMINI_API_KEY not configured" };
    }

    const partners = await ValidatorPartner.find({ isActive: true });
    if (!partners.length) {
        console.log("No active partners found.");
        return { validated: 0 };
    }

    let browser;
    let totalProcessed = 0;

    try {
    browser = await chromium.launch({ headless: true });

    for (const partner of partners) {
        console.log(`\nPartner: ${partner.partnerName}`);
        const credentials = await ValidatorCredential.findOne({ partnerName: partner.partnerName });
        const offers = await ValidatorOffer.find({ partnerName: partner.partnerName, isActive: true });

        if (!offers.length) {
            console.log("  No active offers found for this partner, skipping.");
            continue;
        }

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 }
        });
        const page = await context.newPage();

        for (const offer of offers) {
            console.log(`\n  Testing coupon: ${offer.offerCode} ("${offer.offerTermsAndConditions}")`);
            let logsArr = [];
            let totalSteps = 0;
            let status = "ERROR";

            try {
                logsArr.push(`Navigated to ${offer.offerUrl}`);
                await page.goto(offer.offerUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

                if (credentials) {
                    if (credentials.loginUrl) {
                        logsArr.push(`Going to login: ${credentials.loginUrl}`);
                        await page.goto(credentials.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    }
                    const loginGoal = `We need to log in to the site. ${credentials.loginUrl ? 'You are on the login page.' : 'First, find and click the "Log In" or "Sign In" link/button.'} Log in using username "${credentials.username}" and password "${credentials.password}". After successfully logging in (the page shows a dashboard, homepage, or account page), declare done. If you are already logged in, declare done.`;
                    const loginRes = await performAgentAction(page, loginGoal, logsArr);
                    totalSteps += loginRes.steps;
                    if (!loginRes.success) throw new Error("Login failed");

                    logsArr.push(`Back to ${offer.offerUrl}`);
                    await page.goto(offer.offerUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                }

                const cartGoal = `Browse the store items. Find a product that matches these conditions: "${offer.offerTermsAndConditions}". Add it to the shopping cart. Then navigate to the cart or checkout page where a promo/coupon code can be entered. Once you see a coupon code input field, declare done.`;
                const cartRes = await performAgentAction(page, cartGoal, logsArr);
                totalSteps += cartRes.steps;

                if (!cartRes.success) throw new Error("Could not reach checkout");

                const couponGoal = `Find the promo code or coupon code input field on this checkout page. Type the code "${offer.offerCode}" into that field and click the Apply button. After applying, check if the page shows a success message (like a discount applied or price reduced). If so, declare done. If the page shows an error like "invalid code" or "expired", declare fail.`;
                const couponRes = await performAgentAction(page, couponGoal, logsArr);
                totalSteps += couponRes.steps;

                status = couponRes.success ? "VALID" : "INVALID";

            } catch (err) {
                console.log(`  Error: ${err.message}`);
                logsArr.push(`Error: ${err.message}`);
            }

            totalProcessed++;

            await ValidationResult.create({
                offerId: offer._id,
                partnerName: partner.partnerName,
                merchantLink: partner.merchantLink,
                offerCode: offer.offerCode,
                offerTermsAndConditions: offer.offerTermsAndConditions,
                status,
                aiResponse: logsArr.join("\n"),
                stepsTaken: totalSteps,
                errorMessage: status === "ERROR" ? logsArr[logsArr.length - 1] : ""
            });

            offer.lastStatus = status;
            offer.lastValidated = new Date();
            await offer.save();

            await context.clearCookies();
        }

        await page.close();
        await context.close();
    }

    } catch (err) {
        console.error("Validation run error:", err.message);
    } finally {
        if (browser) await browser.close();
    }
    console.log(`\nRun complete. ${totalProcessed} offers validated this run.`);
    return { validated: totalProcessed };
};

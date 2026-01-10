const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function testModels() {
    console.log('Testing Gemini API models...\n');
    
    const modelsToTest = [
        'models/gemini-2.0-flash-exp',
        'models/gemini-1.5-flash-8b-latest', 
        'models/gemini-1.5-flash',
        'models/gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-pro'
    ];
    
    for (const modelName of modelsToTest) {
        try {
            console.log(`Testing: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Say hello in 3 words');
            const response = await result.response;
            const text = response.text();
            
            console.log(`✅ SUCCESS! Model: ${modelName}`);
            console.log(`Response: ${text.trim()}\n`);
            console.log(`\n🎉 This model works! Use "${modelName}" in your code.\n`);
            return modelName;
        } catch (error) {
            const msg = error.message.split('\n')[0];
            console.log(`❌ Failed: ${msg.substring(0, 150)}\n`);
        }
    }
    
    console.log('\n⚠️  All models failed. Check your API key and permissions.');
    return null;
}

testModels().catch(error => console.error('Fatal error:', error));

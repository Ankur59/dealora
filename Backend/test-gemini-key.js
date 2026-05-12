require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

async function discoverAvailableModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY not found');
        return [];
    }
    
    try {
        console.log('🔍 Discovering available models...\n');
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await axios.get(url);
        
        if (response.data && response.data.models) {
            const allModels = response.data.models;
            console.log(`Found ${allModels.length} total models\n`);
            
            // Filter models that support generateContent
            const contentModels = allModels.filter(m => 
                m.supportedGenerationMethods && 
                m.supportedGenerationMethods.includes('generateContent')
            );
            
            console.log(`${contentModels.length} models support content generation:\n`);
            contentModels.forEach(m => {
                console.log(`  ✓ ${m.name}`);
            });
            
            return contentModels.map(m => m.name.replace('models/', ''));
        }
        
        return [];
    } catch (error) {
        console.error('❌ Failed to discover models:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        }
        return [];
    }
}

async function testGeminiKey() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    console.log('🔑 Testing Gemini API Key...');
    console.log('Key present:', !!apiKey);
    console.log('Key prefix:', apiKey ? apiKey.substring(0, 8) + '...' : 'N/A');
    console.log('');
    
    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY not found in environment');
        return;
    }
    
    // First discover available models
    const availableModels = await discoverAvailableModels();
    
    if (availableModels.length === 0) {
        console.error('\n❌ No models available. API key might be invalid or restricted.');
        return false;
    }
    
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        
        console.log('\n🧪 Testing discovered models...\n');
        
        for (const modelName of availableModels.slice(0, 3)) { // Test first 3
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent('Respond with exactly: "Working"');
                const response = await result.response;
                const text = response.text();
                
                console.log(`✅ ${modelName}: WORKING`);
                console.log(`   Response: ${text.trim()}\n`);
                
                // Return on first working model
                console.log(`\n✅ SUCCESS: Gemini API key is valid and working!`);
                console.log(`   Working model: ${modelName}`);
                return true;
                
            } catch (error) {
                const errorMsg = error.message || String(error);
                console.log(`   Full error: ${errorMsg}`);
                
                if (errorMsg.includes('API key')) {
                    console.error(`❌ ${modelName}: INVALID API KEY`);
                    return false;
                } else if (errorMsg.includes('429') || errorMsg.includes('quota')) {
                    console.warn(`⚠️  ${modelName}: RATE LIMITED / QUOTA EXCEEDED\n`);
                } else if (errorMsg.includes('403') || errorMsg.includes('permission')) {
                    console.warn(`⚠️  ${modelName}: Permission denied\n`);
                } else {
                    console.warn(`⚠️  ${modelName}: ${errorMsg.split('\n')[0]}\n`);
                }
            }
        }
        
        console.error('\n❌ FAILED: All tested models failed. Check your API key permissions or quota.');
        return false;
        
    } catch (error) {
        console.error('❌ FAILED:', error.message);
        return false;
    }
}

// Run the test
testGeminiKey().then(success => {
    process.exit(success ? 0 : 1);
});

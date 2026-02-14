require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function checkAvailableModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ No API Key found in .env");
    return;
  }

  // We will fetch the list directly using the REST API to be absolutely sure
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error("❌ API Error:", data.error.message);
      return;
    }

    console.log("\n✅ AVAILABLE MODELS FOR YOUR KEY:");
    console.log("---------------------------------");
    const models = data.models || [];
    
    // Filter for models that support "generateContent"
    const generateModels = models.filter(m => 
      m.supportedGenerationMethods && 
      m.supportedGenerationMethods.includes("generateContent")
    );

    generateModels.forEach(m => {
      // Print the clean name (e.g., "models/gemini-pro" -> "gemini-pro")
      console.log(`• ${m.name.replace('models/', '')}`);
    });
    console.log("---------------------------------\n");

  } catch (err) {
    console.error("❌ Network Error:", err.message);
  }
}

checkAvailableModels();
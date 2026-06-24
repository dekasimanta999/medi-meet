const asyncHandler = require('express-async-handler');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const analyzeSymptoms = asyncHandler(async (req, res) => {
  const { symptoms, patientData } = req.body;

  if (!symptoms) {
    res.status(400);
    throw new Error("Symptoms are required");
  }

  try {
    // 1. Initialize Gemini with your HARDCODED key (Replace the string below!)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // 2. Using the bulletproof "gemini-pro" model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3. The "Industry Standard" Guardrail Prompt
    const systemPrompt = `
      You are an expert, empathetic medical triage AI for the 'Online Doctor Consultation' platform.
      
      PATIENT PROFILE:
      - Gender: ${patientData?.gender || 'Not specified'}
      - Blood Group: ${patientData?.blood || 'Not specified'}
      - Allergies: ${patientData?.allergies || 'None'}
      - Date of Birth: ${patientData?.dob || 'Not specified'}

      PATIENT MESSAGE: "${symptoms}"

      STRICT RULES:
      1. LIMITATION: You MUST ONLY answer questions related to health, medical symptoms, or doctor recommendations.
      2. REFUSAL: If the user asks about coding, video games, cars, general trivia, or anything non-medical, you MUST reply EXACTLY with: "I am a medical assistant. I can only assist you with health-related inquiries."
      3. PERSONALIZATION: Consider their profile (especially allergies and age/gender) when giving advice.
      4. ACTIONABLE: Always recommend a specific specialist (e.g., Dermatologist, Cardiologist, General Physician) based on their symptoms.
      5. LENGTH & TONE: Keep the response under 3 sentences. Be concise, professional, and empathetic. Do not use Markdown formatting.
    `;

    // 4. Generate the response
    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text();

    // 5. Send back to the frontend
    res.json({ recommendation: responseText });

  } catch (error) {
    console.error("\n====== GEMINI API CRASH REPORT ======");
    console.error(error.message);
    console.error("=====================================\n");

    res.status(500);
    throw new Error('Failed to generate AI response. Check your API key.');
  }
});

module.exports = { analyzeSymptoms };

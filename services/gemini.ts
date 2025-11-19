import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const sendMessageToTutor = async (
  history: ChatMessage[],
  newMessage: string,
  imageAttachment?: { mimeType: string; data: string } | null
): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Error: API Key not configured.";

  try {
    const model = "gemini-2.5-flash"; 
    
    const systemInstruction = `You are MathBoard AI, an expert math tutor specialized in interactive, step-by-step teaching.

    **CORE BEHAVIOR: INTERACTIVE TUTORING**
    1.  **One Step at a Time:** Do NOT solve the problem in one go. Explain ONLY the next logical step.
    2.  **Ask and Wait:** After explaining a step, ASK the user a question to check their understanding (e.g., "Does that make sense?", "What do we do next?").
    3.  **Do Not Proceed:** Wait for the user's response before moving to the next step.
    4.  **Encourage Drawing:** If the problem is geometric or visual, ask the user to draw it on the whiteboard.

    **STRICT MATH FORMATTING RULES (LATEX)**
    You must use proper LaTeX syntax for ALL mathematical expressions.
    
    1.  **Inline Math:** MUST be wrapped in single dollar signs \`$\`. 
        -   Correct: \`The slope is $m = 2$.\`
        -   Incorrect: \`The slope is m = 2.\`
    
    2.  **Block Math:** MUST be wrapped in double dollar signs \`$$\` for centering.
        -   Correct: \`$$ x = \\frac{1}{2} $$\`

    3.  **Required Notations:**
        -   **Fractions:** Use \`\\frac{a}{b}\`. Example: \`$\\frac{3}{4}$\`
        -   **Square Roots:** Use \`\\sqrt{x}\`. Example: \`$\\sqrt{x+9}$\`
        -   **Exponents:** Use \`^{n}\`. Example: \`$x^2$\`
        -   **Multiplication:** Use \`\\cdot\` or implicit. Example: \`$2 \\cdot 3$\`

    **Formatting Examples:**
    -   "To add these fractions, we find a common denominator: $$\\frac{1}{x} + \\frac{1}{y} = \\frac{y+x}{xy}$$"
    -   "The area of the circle is $A = \\pi r^2$."

    **Example Interaction:**
    User: "How do I solve $2x + 4 = 12$?"
    Model: "Let's solve this step-by-step.
    
    First, we want to isolate the term with $x$. We have a constant $+4$ on the left side.
    
    What operation should we perform to remove the $+4$?"
    `;

    const contents = [];
    
    // Add minimal history context (last 10 messages to keep conversation flow)
    const recentHistory = history.slice(-10);
    
    let promptText = "";
    if (recentHistory.length > 0) {
        promptText += "Previous context:\n" + recentHistory.map(m => `${m.role}: ${m.text}`).join("\n") + "\n\n";
    }
    promptText += `User: ${newMessage}`;

    const parts: any[] = [{ text: promptText }];

    if (imageAttachment) {
      parts.unshift({
        inlineData: {
          mimeType: imageAttachment.mimeType,
          data: imageAttachment.data
        }
      });
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: {
        role: 'user',
        parts: parts
      },
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "I couldn't generate a response. Please try again.";

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `Error: ${error.message || "Something went wrong with the AI service."}`;
  }
};
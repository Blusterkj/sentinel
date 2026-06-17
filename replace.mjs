import fs from 'fs';

const filePath = 'c:/Users/blust/sentinel/proxy.mjs';
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

const newCode = `    // Build the user message with recalled context prepended
    const augmentedUserMessage = recalledContext
      ? \`\${recalledContext}\\n\\n## USER QUESTION\\n\${message}\`
      : message;

    // Convert past history to string to append to the system prompt
    const historyContext = history.length > 0
      ? \`\\n\\n## RECENT CHAT HISTORY\\n\${history.map(h => \`\${h.role.toUpperCase()}: \${h.content}\`).join('\\n\\n')}\`
      : '';

    // Final Gemini Prompt
    const fullPrompt = \`\${SYSTEM_PROMPT}\${historyContext}\\n\\nUser question: \${augmentedUserMessage}\`;

    const geminiUrl = \`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${process.env.GEMINI_API_KEY}\`;
    
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: fullPrompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7
        }
      })
    });

    if (!geminiRes.ok) {
      const errTxt = await geminiRes.text();
      throw new Error(\`Gemini API error \${geminiRes.status}: \${errTxt}\`);
    }

    const geminiData = await geminiRes.json();
    const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log(\`   ✅ Agent responded (\${resultText.length} chars)\`);
    
    // SAVE: Immediately save the full exchange to Walrus
    if (walletAddress) {
      const exchange = { user: message, agent: resultText };
      const dataBuffer = Buffer.from(JSON.stringify(exchange));`;

lines.splice(759, 21, newCode); // Lines are 0-indexed, so 759 is line 760. We replace from 760 up to 780 (21 lines)

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Spliced proxy.mjs');

// Cloudflare Pages Function — /api/ai-pdf
// Handles: chat, summarise, translate, command, create-form

export async function onRequestPost({ request, env }) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = await request.json();
    const { action, text, question, language, style, focus, command, context, history, description } = body;

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers });

    let systemPrompt = '';
    let userMessage = '';

    if (action === 'chat') {
      systemPrompt = `You are a helpful PDF document assistant. The user has uploaded a PDF and wants to ask questions about it. Answer based on the document context provided. Be concise and helpful.`;
      const historyText = (history || []).slice(-6).map(h => `${h.role}: ${h.content}`).join('\n');
      userMessage = `Document content:\n${text || context || 'No content available'}\n\n${historyText ? 'Previous conversation:\n' + historyText + '\n\n' : ''}Question: ${question}`;

    } else if (action === 'summarise') {
      const styleInstructions = {
        structured: 'Provide a well-structured summary with sections: Overview, Key Points, Main Arguments, and Conclusion.',
        brief: 'Provide a brief 2-3 paragraph summary.',
        bullets: 'Provide a bullet-point summary of the main points.',
        executive: 'Provide an executive summary suitable for senior management.'
      };
      const focusInstructions = {
        legal: 'Pay special attention to legal terms, obligations, rights, and clauses.',
        financial: 'Pay special attention to financial figures, costs, revenue, and monetary terms.',
        technical: 'Pay special attention to technical specifications, processes, and requirements.',
        general: ''
      };
      systemPrompt = `You are a professional document summariser. ${styleInstructions[style] || styleInstructions.structured} ${focusInstructions[focus] || ''}`;
      userMessage = `Please summarise this document:\n\n${text || 'No content provided'}`;

    } else if (action === 'translate') {
      systemPrompt = `You are a professional translator. Translate the provided text to ${language || 'Spanish'}. Preserve the structure and formatting as much as possible. Only provide the translation, no explanations.`;
      userMessage = `Translate this text to ${language || 'Spanish'}:\n\n${text || 'No content provided'}`;

    } else if (action === 'command') {
      systemPrompt = `You are a PDF editing assistant for RightPDFKit. The user wants to perform operations on their PDF. 
Available tools: delete pages, rotate, extract, watermark, compress, add header/footer, add page numbers, protect, split, grayscale, resize, metadata.
Parse their command and respond with:
1. A clear plan of what actions to take
2. Which RightPDFKit tools to use
3. Any settings needed
Be concise and helpful. If the command is unclear, ask for clarification.`;
      userMessage = `PDF context: ${context || 'PDF loaded'}\n\nUser command: ${command}`;

    } else if (action === 'create-form') {
      systemPrompt = `You are a PDF form designer. When given a description, list the form fields needed with their types (text, checkbox, radio, date, signature). Be concise.`;
      userMessage = `Create a form for: ${description || 'generic form'}`;

    } else {
      return new Response(JSON.stringify({ error: 'Unknown action: ' + action }), { status: 400, headers });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: 'API error: ' + err }), { status: 500, headers });
    }

    const data = await response.json();
    const result = data.content?.[0]?.text || 'No response';

    // Return appropriate field based on action
    const responseData = {
      text: result,
      answer: result,      // for chat
      summary: result,     // for summarise
      translation: result, // for translate
      result: result,      // for command/form
    };

    return new Response(JSON.stringify(responseData), { status: 200, headers });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

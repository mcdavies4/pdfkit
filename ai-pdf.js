// Cloudflare Pages Function — functions/api/ai-pdf.js
// Deploy to: /functions/api/ai-pdf.js in your GitHub repo

export async function onRequest({ request, env }) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const body = await request.json();
    const { action, text, question, language, style, focus, command, context, history, description } = body;

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: 'ANTHROPIC_API_KEY not set. Go to Cloudflare Pages → Settings → Environment Variables and add it.' 
      }), { status: 500, headers });
    }

    let systemPrompt = '';
    let userMessage = '';

    if (action === 'chat') {
      systemPrompt = 'You are a helpful PDF assistant. Answer questions about the document context provided. Be concise.';
      const ctx = text || context || '';
      const historyText = (history || []).slice(-4).map(h => `${h.role}: ${h.content}`).join('\n');
      userMessage = ctx ? `Document:\n${ctx.substring(0, 8000)}\n\n${historyText ? historyText + '\n\n' : ''}Question: ${question}` : `Question: ${question}`;

    } else if (action === 'summarise') {
      const styles = {
        structured: 'Summarise with: Overview, Key Points, Main Arguments, Conclusion.',
        brief: 'Write a brief 2-3 paragraph summary.',
        bullets: 'Summarise as bullet points.',
        executive: 'Write an executive summary.'
      };
      systemPrompt = `You are a document summariser. ${styles[style] || styles.structured}${focus && focus !== 'general' ? ' Focus on ' + focus + ' aspects.' : ''}`;
      userMessage = `Summarise:\n\n${(text || '').substring(0, 10000)}`;

    } else if (action === 'translate') {
      systemPrompt = `Translate the text to ${language || 'Spanish'}. Only provide the translation, no explanations or preamble.`;
      userMessage = (text || '').substring(0, 8000);

    } else if (action === 'command') {
      systemPrompt = `You are a PDF editing assistant for RightPDFKit. Parse the user's natural language command and describe:
1. What PDF operations to perform
2. Which RightPDFKit tools to use (merge, split, compress, rotate, watermark, annotate, etc.)
3. Step by step instructions

Be specific and actionable.`;
      userMessage = `PDF context: ${(context || 'PDF loaded').substring(0, 2000)}\n\nCommand: ${command}`;

    } else if (action === 'create-form') {
      systemPrompt = 'You are a form designer. List the fields needed for the described form with their types.';
      userMessage = `Create form fields for: ${description}`;

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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ 
        error: 'Anthropic API error ' + response.status + ': ' + errText.substring(0, 200) 
      }), { status: 500, headers });
    }

    const data = await response.json();
    const result = data.content?.[0]?.text || 'No response';

    return new Response(JSON.stringify({
      text: result,
      answer: result,
      summary: result,
      translation: result,
      result: result,
    }), { status: 200, headers });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
}

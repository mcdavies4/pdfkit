// Vercel Serverless Function — /api/ai-pdf
// Handles three modes:
// 1. command — NL PDF commands (existing)
// 2. vision  — image analysis via Claude vision API
// 3. extract — text extraction/analysis

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { command, mode, imageBase64, imageMediaType } = req.body || {};
  if (!command) return res.status(400).json({ error: 'Missing command' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server configuration error' });

  const SYSTEM_PROMPT = `You are a PDF command parser for RightPDFKit.
Convert natural language PDF editing instructions into a JSON action plan.
Respond ONLY with a valid JSON array. No explanation, no markdown, no backticks.

Available actions:
- {"tool":"delete","pages":"1,3-5"}
- {"tool":"rotate","angle":90,"target":"all","pages":"1-3"}
- {"tool":"extract","pages":"1,3-5"}
- {"tool":"watermark","text":"CONFIDENTIAL","opacity":0.25,"angle":35,"size":"medium"}
- {"tool":"headfoot","headerText":"{page} of {total}","footerText":"","fontSize":10}
- {"tool":"pagenums","position":"bc","startNum":1,"prefix":""}
- {"tool":"compress"}
- {"tool":"grayscale","scale":2}
- {"tool":"resize","preset":"a4","scale":"fit"}
- {"tool":"flatten","removeAnnots":true}
- {"tool":"metadata","title":"","author":"","subject":"","keywords":""}
- {"tool":"protect","userPassword":"pass","ownerPassword":"pass"}
- {"tool":"unlock","password":"pass"}
- {"tool":"blankpage","pos":"end","qty":1,"size":"match"}
- {"tool":"dupepage","pages":"1","pos":"after","copies":1}
- {"tool":"split","mode":"all","range":""}
- {"tool":"pdftoword","pages":"all"}

Rules:
- Return array even for single actions
- Default watermark opacity: 0.25, angle: 35
- Default page numbers position: "bc"
- If unclear: [{"tool":"error","message":"Could not understand: explain why"}]`;

  try {
    let messages;

    if (mode === 'vision' && imageBase64) {
      // Vision mode — analyse an image
      messages = [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMediaType || 'image/jpeg',
              data: imageBase64,
            }
          },
          { type: 'text', text: command }
        ]
      }];
    } else {
      // Command or extract mode — text only
      messages = [{ role: 'user', content: command }];
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
        max_tokens: mode === 'vision' ? 1000 : 500,
        system: mode === 'command' || !mode ? SYSTEM_PROMPT : undefined,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(502).json({ error: err.error?.message || `Claude API error ${response.status}` });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    if (mode === 'command' || !mode) {
      // Parse as JSON plan
      const clean = text.replace(/```json|```/g, '').trim();
      let plan;
      try { plan = JSON.parse(clean); }
      catch(e) { return res.status(502).json({ error: 'AI returned invalid response' }); }
      if (!Array.isArray(plan)) return res.status(502).json({ error: 'AI returned unexpected format' });
      return res.status(200).json({ plan });
    } else {
      // Return raw text result for vision/extract modes
      return res.status(200).json({ result: text });
    }

  } catch (err) {
    console.error('AI PDF error:', err);
    return res.status(500).json({ error: 'Server error — please try again' });
  }
}

/**
 * Generischer LLM-Aufruf (OpenAI-kompatibel + Google Gemini).
 */
const llmUrl = () => process.env.LLM_API_URL?.trim();
const llmKey = () => process.env.LLM_API_KEY?.trim();
const llmModel = () => process.env.LLM_MODEL?.trim();

export function isLlmConfigured(): boolean {
  return !!(llmUrl() && llmKey() && llmModel());
}

export async function callLlm(systemPrompt: string, userPrompt: string): Promise<string> {
  const url = llmUrl();
  const key = llmKey();
  const model = llmModel();

  if (!url || !key || !model) {
    throw new Error('LLM-Umgebungsvariablen (LLM_API_URL, LLM_API_KEY, LLM_MODEL) sind nicht gesetzt.');
  }

  const isGoogleApi = url.includes('generativelanguage.googleapis.com');
  const fetchUrl = isGoogleApi
    ? `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`
    : url;

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  };

  if (isGoogleApi) {
    (fetchOptions as Record<string, unknown>).body = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 2048,
      },
    });
  } else {
    (fetchOptions as Record<string, unknown>).headers = {
      ...((fetchOptions.headers as Record<string, string>) ?? {}),
      Authorization: `Bearer ${key}`,
    };
    (fetchOptions as Record<string, unknown>).body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
  }

  const res = await fetch(fetchUrl, fetchOptions);

  if (!res.ok) {
    const text = await res.text();
    let details: unknown = text;
    try {
      details = JSON.parse(text);
    } catch {
      // ignore
    }
    throw new Error(`LLM-Anfrage fehlgeschlagen: ${res.status} - ${JSON.stringify(details)}`);
  }

  const json = await res.json();
  const content = isGoogleApi
    ? json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    : json.choices?.[0]?.message?.content ?? '';

  return content;
}

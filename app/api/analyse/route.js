export const maxDuration = 60;

export async function POST(request) {
  try {
    const { base64, mime } = await request.json();

    if (!base64 || !mime) {
      return Response.json({ error: "Missing base64 or mime" }, { status: 400 });
    }

    const prompt = `You are an expert interior designer. Analyse this room photo. Return ONLY raw JSON with no markdown, no code fences, no explanation. Use only plain ASCII in string values.

{
  "roomType": "living room",
  "elegant": {
    "overview": "Two sentence vision.",
    "keyChanges": ["Change 1", "Change 2", "Change 3", "Change 4"],
    "colourPalette": "One sentence about colours.",
    "lightingPlan": "One sentence about lighting.",
    "purchaseItems": [
      {"icon":"sofa","name":"Item name","note":"Why and where to buy"},
      {"icon":"lamp","name":"Item name","note":"Why and where to buy"},
      {"icon":"art","name":"Item name","note":"Why and where to buy"},
      {"icon":"plant","name":"Item name","note":"Why and where to buy"},
      {"icon":"rug","name":"Item name","note":"Why and where to buy"}
    ]
  },
  "casual": {
    "overview": "Two sentence vision.",
    "keyChanges": ["Change 1", "Change 2", "Change 3", "Change 4"],
    "colourPalette": "One sentence about colours.",
    "lightingPlan": "One sentence about lighting.",
    "purchaseItems": [
      {"icon":"sofa","name":"Item name","note":"Why and where to buy"},
      {"icon":"chair","name":"Item name","note":"Why and where to buy"},
      {"icon":"lamp","name":"Item name","note":"Why and where to buy"},
      {"icon":"plant","name":"Item name","note":"Why and where to buy"},
      {"icon":"basket","name":"Item name","note":"Why and where to buy"}
    ]
  }
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
            { type: "text", text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return Response.json({ error: data.error.message }, { status: 500 });

    const raw = (data.content || []).map(b => b.text || "").join("");

    let cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end   = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON in Claude response");
    cleaned = cleaned.slice(start, end + 1).replace(/[\x00-\x1F\x7F]/g, " ");
    const parsed = JSON.parse(cleaned);

    return Response.json(parsed);

  } catch (err) {
    console.error("Analyse error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

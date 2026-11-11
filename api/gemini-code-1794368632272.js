// api/generate.js

// CEFR-J Benchmark Definitions for Evaluation & Question Design
const cefrStandards = {
  'Pre-A1': {
    label: 'CEFR-J Pre-A1 (Introductory / Foundation)',
    criteria: 'CEFR-J Pre-A1. Expect ultra-short formulaic expressions, 3-5 word phrases, and very basic present simple. Do not demand complex linkers or long sentences. Keep interactions simple and direct.'
  },
  'A1.1': {
    label: 'CEFR-J A1.1 (High School 1st Yr Foundation)',
    criteria: 'CEFR-J A1.1. Expect basic present simple, familiar daily words, and short single-clause responses.'
  },
  'A1.2': {
    label: 'CEFR-J A1.2 (High School 1st Yr Standard)',
    criteria: 'CEFR-J A1.2. Expect basic complete sentences, simple past tense usage, and frequency adverbs.'
  },
  'A1.3': {
    label: 'CEFR-J A1.3 (High School 1st/2nd Yr Solid A1)',
    criteria: 'CEFR-J A1.3. Expect future forms (be going to / will) and basic conjunctions (because, but, and).'
  },
  'A2.1': {
    label: 'CEFR-J A2.1 (High School 2nd Yr / Eiken 3rd)',
    criteria: 'CEFR-J A2.1. Expect connected sentences, present perfect experience, basic personal opinion justifications, and if/when clauses.'
  },
  'A2.2': {
    label: 'CEFR-J A2.2 (High School 2nd/3rd Yr / Eiken Pre-2nd)',
    criteria: 'CEFR-J A2.2. Expect relative pronouns (who/which/that), passive voice, and expressing simple reasons with clarity.'
  },
  'B1.1': {
    label: 'CEFR-J B1.1 (High School 3rd Yr / Eiken 2nd)',
    criteria: 'CEFR-J B1.1. Expect indirect questions, opinion inquiries, compound sentences, and nuanced everyday discussions.'
  },
  'B1.2': {
    label: 'CEFR-J B1.2 (Advanced High School / Eiken Pre-1st)',
    criteria: 'CEFR-J B1.2. Expect complex subordinate clauses, abstract thoughts, comparison of options, and structured discourse.'
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, userSpeech, audioData, mimeType, step, totalSteps, cefrLevel, chatHistory, customNotes } = req.body;
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'AI_API_KEY environment variable is missing.' });
  }

  const targetStandard = cefrStandards[cefrLevel] || cefrStandards['A1.1'];
  const maxSteps = totalSteps || 6;

  // STRICT PRIVACY & SAFETY DIRECTIVE
  const privacyDirective = `
[STRICT PRIVACY & PII RULE]:
NEVER ask the student for personally identifiable information (PII) under any circumstances.
Prohibited topics: Full name, student ID numbers, street address, specific school name, phone numbers, or passwords.
Keep questions focused on general topics like hobbies, daily routines, weekend plans, school subjects, sports, food, movies, or weather.
`;

  // QUESTION GENERATION & CONTINUITY DIRECTIVE
  const questionStyleDirective = `
[QUESTION & FOLLOW-UP CONTINUITY RULE]:
1. ALWAYS ASK EXACTLY ONE SINGLE QUESTION per turn. Never ask multiple questions in one turn.
2. CONTINUITY & FOLLOW-UP: Carefully analyze the student's previous answer. Ask a natural, relevant follow-up question based on what they just said whenever possible (e.g., if they say "I played soccer," follow up with "Do you play soccer on weekends?" or "Who is your favorite soccer player?").
3. Only introduce a new general topic if the current topic has been naturally exhausted or if it is the first question.
`;

  const teacherGuidanceBlock = customNotes ? `\n[SPECIAL TEACHER INSTRUCTIONS FOR THIS SESSION]:\n${customNotes}\n(Please strictly incorporate these custom guidelines into your evaluation style, leniency, or handling of topics.)\n` : '';

  const pronunciationLenience = `\n[PRONUNCIATION TOLERANCE INSTRUCTION]:\nThe student is a Japanese high school learner. Be extremely forgiving of Japanese-accented English, phonetic slips, or imperfect pronunciation in the audio. Transcribe and interpret what they meant at the ${targetStandard.label} standard, looking past minor phonetic transcription variations.\n`;

  let parts = [];

  if (audioData) {
    let cleanMime = (mimeType || 'audio/webm').split(';')[0].trim();
    if (!cleanMime.startsWith('audio/')) {
      cleanMime = 'audio/webm';
    }

    parts.push({
      inlineData: {
        mimeType: cleanMime,
        data: audioData
      }
    });
  }

  let prompt = '';

  if (action === 'transcribe_audio') {
    prompt = `You are an expert English audio transcriber for Japanese high school learners at ${targetStandard.label}.
${pronunciationLenience}
Listen to the attached audio recording. Transcribe the spoken English accurately into text, being extremely forgiving of Japanese accents, phonetic slips, or minor variations.

Respond ONLY with a valid raw JSON object matching this structure (no markdown formatting or backticks):
{
  "transcribedText": "The transcribed English text"
}`;
  } else if (action === 'start_chat') {
    prompt = `You are a supportive, friendly English chat partner conducting a ${maxSteps}-step conversation with a Japanese high school student at ${targetStandard.label}.
Standard Benchmark: ${targetStandard.criteria}
${privacyDirective}
${questionStyleDirective}
${teacherGuidanceBlock}

For Step 1 (the very first opening message), ask a single, warm opening question suited for ${targetStandard.label} (e.g., "Hello, how are you today?").

Respond ONLY with a valid raw JSON object:
{
  "nextQuestion": "Single opening question tailored to ${targetStandard.label}"
}`;
  } else if (action === 'chat_turn') {
    const contextHistory = (chatHistory || []).map(t => `Step ${t.step} Student: "${t.userSpeech}"`).join('\n');

    prompt = `You are a supportive English chat partner conducting a casual, adaptive conversation with a Japanese high school student at ${targetStandard.label}.
Current Step completed: ${step} of ${maxSteps}.
Standard Benchmark: ${targetStandard.criteria}
${privacyDirective}
${questionStyleDirective}
${teacherGuidanceBlock}

Conversation History:
${contextHistory}

Latest Student Text: "${userSpeech}"

CRITICAL RULES:
1. Provide brief, encouraging coaching feedback in natural JAPANESE regarding their response. Validate correct usage or gently point out key vocabulary/grammar errors matching ${targetStandard.label}.
2. ASK EXACTLY ONE SINGLE QUESTION. Never ask multiple questions in one turn. Follow up naturally on what they just said.

Respond ONLY with a valid raw JSON object matching this structure (no markdown formatting or backticks):
{
  "feedback": "1-2 sentence friendly feedback in Japanese about their response",
  "nextQuestion": "Single follow-up question for the next step matching ${targetStandard.label}"
}`;
  } else if (action === 'generate_summary_report') {
    const transcriptText = (chatHistory || []).map((t, idx) => `Turn ${idx + 1}: ${t.userSpeech}`).join('\n');

    prompt = `You are an expert English language coach evaluating a student's complete ${maxSteps}-turn speaking and chat session evaluated specifically against the ${targetStandard.label} standard.

Standard Benchmark: ${targetStandard.criteria}
${teacherGuidanceBlock}
${pronunciationLenience}

Student Transcripts:
${transcriptText}

INSTRUCTIONS:
1. Provide an overall evaluation in JAPANESE evaluated specifically against the ${targetStandard.label} standard and any special teacher instructions provided.
2. Rate the student's overall performance out of 100% in 4 areas based strictly on ${targetStandard.label} expectations: Clarity (明瞭さ), Fluency (流暢さ), Vocabulary (語彙力), Grammar (文法).
3. Summarize UP TO 4 key corrections/upgrades derived from their overall conversation session. If the student made fewer than 4 errors, only list the actual errors. If their English was completely perfect, leave the array empty. Do not invent errors to fill a quota!
   - The Student Answers are raw transcripts. You MUST evaluate errors based ONLY on incorrect words (e.g., wrong verb tense, unnatural vocabulary).
   - VALID CORRECTION EXAMPLE: changing "he go to school" to "he goes to school".
   - INVALID CORRECTION EXAMPLE: changing "i like apples" to "I like apples." -> NEVER choose a correction where the only difference is punctuation.
4. DO NOT 'upgrade' perfectly natural short answers. If the student uses a correct short answer appropriate for their level, you MUST accept it as perfect. Never change a natural auxiliary verb answer into an overly complex sentence unnecessarily. Only fix genuine errors.
5. ABSOLUTE SCORING RULE: Evaluate grammar and clarity based strictly on the spoken words. Do not deduct points for sentences appearing to run together due to the lack of periods in the transcript.

Respond ONLY with raw JSON matching this structure (no markdown, no backticks). The "keyCorrections" array can contain 0 to 4 items:
{
  "headline": "Short encouraging main Japanese headline",
  "subheading": "2-3 sentences overall evaluation summary in Japanese written as a supportive coach evaluated against ${targetStandard.label}.",
  "scores": {
    "clarity": 85,
    "clarityComment": "Japanese comment about clarity evaluated against ${targetStandard.label}",
    "fluency": 80,
    "fluencyComment": "Japanese comment about fluency evaluated against ${targetStandard.label}",
    "vocabulary": 82,
    "vocabularyComment": "Japanese comment about vocabulary evaluated against ${targetStandard.label}",
    "grammar": 78,
    "grammarComment": "Japanese comment about grammar evaluated against ${targetStandard.label}"
  },
  "keyCorrections": [
    {
      "question": "The exact question the student was answering",
      "youSaid": "Student's original exact spoken words",
      "cleaner": "Improved, natural English phrasing matching ${targetStandard.label}",
      "explanation": "Japanese explanation focusing purely on vocabulary, word choice, or word-level grammar."
    }
  ]
}`;
  } else {
    return res.status(400).json({ error: 'Invalid action provided.' });
  }

  // Push the prompt into the parts array
  parts.push({ text: prompt });

  const cleanKey = encodeURIComponent(apiKey.trim());
  const url = 'https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite:generateContent?key=' + cleanKey;

  // FIX: Pass the populated `parts` array instead of discarding it!
  const requestPayload = {
    contents: [{ parts: parts }]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Google AI API request failed.' });
    }

    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) return res.status(500).json({ error: 'AI returned an empty response or triggered content filtering.' });

    if (action === 'generate_summary_report') {
      try {
        return res.status(200).json({ report: JSON.parse(generatedText.replace(/```json/g, '').replace(/```/g, '').trim()) });
      } catch (e) {
        return res.status(500).json({ error: 'Failed to parse report JSON structure.' });
      }
    }

    return res.status(200).json(JSON.parse(generatedText.replace(/```json/g, '').replace(/```/g, '').trim()));

  } catch (error) {
    return res.status(500).json({ error: `Connection error: ${error.message}` });
  }
}
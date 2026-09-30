import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const AI_ENABLED = process.env.AI_ENABLED !== 'false';
const hasRealKey = process.env.ANTHROPIC_API_KEY && 
                   !process.env.ANTHROPIC_API_KEY.includes('...') && 
                   !process.env.ANTHROPIC_API_KEY.includes('mock');

const anthropic = (AI_ENABLED && hasRealKey) ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
}) : null;

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const TIMEOUT = 10000;

// Schemas
const TagSchema = z.object({
  title: z.string(),
  category: z.string(),
  color: z.string(),
  brand: z.string(),
  tags: z.array(z.string()),
  description: z.string(),
  hidden_details: z.object({
    distinguishing_features: z.array(z.string()),
    contents: z.array(z.string()),
    marks: z.array(z.string()),
    condition: z.string()
  })
});

const MatchSchema = z.array(z.object({
  found_id: z.number(),
  score: z.number().min(0).max(100),
  reason: z.string()
}));

const QuestionsSchema = z.array(z.string()).length(3);

const ScoreSchema = z.object({
  score: z.number().min(0).max(100),
  per_question: z.array(z.object({
    question: z.string(),
    score: z.number(),
    reasoning: z.string()
  })),
  passed: z.boolean()
});

// Helper to strip code fences and parse JSON
function parseAIJson(text) {
  const stripped = text.replace(/```json\s*|\s*```/g, '').trim();
  return JSON.parse(stripped);
}

// Helper to call Claude with timeout
async function callClaude(messages, systemPrompt) {
  if (!AI_ENABLED || !anthropic) {
    throw new Error('AI not enabled');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages
    }, { signal: controller.signal });

    return response.content[0].text;
  } finally {
    clearTimeout(timeout);
  }
}

// Tag image from buffer
export async function tagImage(buffer, mimeType, userDescription = '') {
  try {
    const base64 = buffer.toString('base64');
    
    const systemPrompt = `You are an expert at analyzing images of lost/found items. Extract detailed information and output ONLY valid JSON with no markdown formatting.`;
    
    const userPrompt = `Analyze this ${userDescription ? `"${userDescription}"` : 'item'} image and extract:
- title (concise name)
- category (one of: electronics, clothing, documents, personal, accessories, books, sports, other)
- color (dominant color)
- brand (if visible, else "unknown")
- tags (array of searchable keywords)
- description (2-3 sentences)
- hidden_details object with:
  - distinguishing_features (unique characteristics only the owner would know)
  - contents (what's inside, if applicable)
  - marks (scratches, stickers, writing, etc.)
  - condition (overall state)

Output ONLY JSON, no other text:
{"title": "...", "category": "...", "color": "...", "brand": "...", "tags": [...], "description": "...", "hidden_details": {...}}`;

    const response = await callClaude([
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64
            }
          },
          {
            type: 'text',
            text: userPrompt
          }
        ]
      }
    ], systemPrompt);

    const parsed = parseAIJson(response);
    const validated = TagSchema.parse(parsed);
    return validated;

  } catch (error) {
    console.error('AI tagging failed, using fallback:', error.message);
    
    // Fallback
    return {
      title: userDescription || 'Item',
      category: 'other',
      color: 'unknown',
      brand: 'unknown',
      tags: userDescription ? userDescription.toLowerCase().split(/\s+/).filter(w => w.length > 2) : [],
      description: userDescription || 'No description available',
      hidden_details: {
        distinguishing_features: [],
        contents: [],
        marks: [],
        condition: 'unknown'
      }
    };
  }
}

// Re-rank matches using AI
export async function rerankMatches(lostItem, candidates) {
  if (candidates.length === 0) return [];
  
  try {
    const systemPrompt = `You are an expert at matching lost and found items. Analyze the lost item and candidates, then rank them by likelihood of being the same item. Output ONLY valid JSON array.`;
    
    const userPrompt = `Lost item:
Title: ${lostItem.title}
Description: ${lostItem.description || 'none'}
Category: ${lostItem.category}
Color: ${lostItem.color}
Brand: ${lostItem.brand || 'unknown'}
Tags: ${lostItem.tags.join(', ')}
Location: ${lostItem.location_name}
Time: ${lostItem.happened_at}

Found item candidates (max 5):
${candidates.map((c, i) => `
${i + 1}. ID: ${c.id}
   Title: ${c.title}
   Description: ${c.description || 'none'}
   Category: ${c.category}
   Color: ${c.color}
   Brand: ${c.brand || 'unknown'}
   Tags: ${c.tags.join(', ')}
   Location: ${c.location_name}
   Time: ${c.happened_at}
`).join('\n')}

Score each candidate 0-100 based on similarity. Consider category, description, color, brand, tags, location proximity, and timing.

Output ONLY JSON array:
[{"found_id": 123, "score": 85, "reason": "..."}, ...]`;

    const response = await callClaude([
      { role: 'user', content: userPrompt }
    ], systemPrompt);

    const parsed = parseAIJson(response);
    const validated = MatchSchema.parse(parsed);
    return validated;

  } catch (error) {
    console.error('AI reranking failed, using fallback:', error.message);
    
    // Fallback: score based on tag overlap
    return candidates.map(c => {
      const lostTags = new Set(lostItem.tags);
      const foundTags = new Set(c.tags);
      const overlap = [...lostTags].filter(t => foundTags.has(t)).length;
      const score = Math.min(100, overlap * 20);
      
      return {
        found_id: c.id,
        score,
        reason: `${overlap} matching tags`
      };
    }).sort((a, b) => b.score - a.score);
  }
}

// Generate verification questions
export async function generateQuestions(hiddenDetails) {
  try {
    const systemPrompt = `You are creating verification questions to prove someone owns a lost item. Generate exactly 3 questions that only the true owner could answer. Questions should be about specific details, not general descriptions. Output ONLY a JSON array of 3 question strings.`;
    
    const userPrompt = `Hidden details about the item:
Distinguishing features: ${hiddenDetails.distinguishing_features?.join(', ') || 'none'}
Contents: ${hiddenDetails.contents?.join(', ') || 'none'}
Marks: ${hiddenDetails.marks?.join(', ') || 'none'}
Condition: ${hiddenDetails.condition || 'unknown'}

Generate 3 specific questions only the owner would know. Examples:
- "What distinctive mark is on the back?"
- "What was inside the case?"
- "Describe the condition of the item"

Output ONLY JSON array: ["question 1", "question 2", "question 3"]`;

    const response = await callClaude([
      { role: 'user', content: userPrompt }
    ], systemPrompt);

    const parsed = parseAIJson(response);
    const validated = QuestionsSchema.parse(parsed);
    return validated;

  } catch (error) {
    console.error('AI question generation failed, using fallback:', error.message);
    
    // Fallback generic questions
    return [
      "Can you describe any distinctive features or marks on the item?",
      "What was the exact condition of the item when you lost it?",
      "Were there any contents inside or attached to the item?"
    ];
  }
}

// Score answers against hidden details
export async function scoreAnswers(questions, answers, hiddenDetails) {
  try {
    const systemPrompt = `You are verifying if someone is the true owner of a lost item by scoring their answers. Be lenient on wording but strict on factual accuracy. Output ONLY valid JSON.`;
    
    const userPrompt = `Hidden details (ground truth):
Distinguishing features: ${hiddenDetails.distinguishing_features?.join(', ') || 'none'}
Contents: ${hiddenDetails.contents?.join(', ') || 'none'}
Marks: ${hiddenDetails.marks?.join(', ') || 'none'}
Condition: ${hiddenDetails.condition || 'unknown'}

Questions and user's answers:
${questions.map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i] || 'no answer'}`).join('\n\n')}

Score each answer 0-100 based on accuracy against hidden details. Be lenient with synonyms and phrasing. Calculate total score and determine if passed (>=70).

Output ONLY JSON:
{"score": 75, "per_question": [{"question": "...", "score": 80, "reasoning": "..."}], "passed": true}`;

    const response = await callClaude([
      { role: 'user', content: userPrompt }
    ], systemPrompt);

    const parsed = parseAIJson(response);
    const validated = ScoreSchema.parse(parsed);
    return validated;

  } catch (error) {
    console.error('AI scoring failed, using fallback:', error.message);
    
    // Fallback: keyword matching
    const detailsText = JSON.stringify(hiddenDetails).toLowerCase();
    const perQuestion = questions.map((q, i) => {
      const answer = (answers[i] || '').toLowerCase();
      const words = answer.split(/\s+/).filter(w => w.length > 2);
      const matches = words.filter(w => detailsText.includes(w)).length;
      const score = Math.min(100, matches * 25);
      
      return {
        question: q,
        score,
        reasoning: `${matches} keyword matches`
      };
    });
    
    const avgScore = Math.round(perQuestion.reduce((sum, q) => sum + q.score, 0) / questions.length);
    
    return {
      score: avgScore,
      per_question: perQuestion,
      passed: avgScore >= 70
    };
  }
}

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Fetch website content
async function fetchWebsiteContent(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AttriosBot/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Extract text content (simple approach - strip most HTML)
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text.substring(0, 50000); // Limit to first 50k chars
  } catch (error) {
    console.error('Website fetch error:', error);
    return null;
  }
}

// Analyze business using Claude
async function analyzeBusiness(websiteUrl, websiteContent, companyName) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Analyze this business website and provide a detailed profile for remarketing campaign generation.

Website: ${websiteUrl}
Company: ${companyName || 'Unknown'}

Website Content:
${websiteContent}

Please provide:
1. Industry/Business Type
2. Target Audience (demographics, needs, pain points)
3. Brand Tone (professional, casual, technical, friendly, etc.)
4. Primary Business Goals (what they're trying to achieve)
5. Key Products/Services
6. Unique Value Proposition

Format your response as a structured analysis that will help generate personalized remarketing emails.`
      }]
    });

    return message.content[0].text;
  } catch (error) {
    console.error('Claude analysis error:', error);
    return null;
  }
}

// Create context file for client
function createContextFile(clientId, websiteUrl, companyName, analysis) {
  try {
    const contextDir = path.join(process.cwd(), 'data', 'clients', clientId);

    // Create directory if it doesn't exist
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }

    const contextFile = path.join(contextDir, 'context.md');

    const contextContent = `# Client Context: ${companyName || 'Unknown Company'} (${clientId})

**Website:** ${websiteUrl}
**Analysis Date:** ${new Date().toISOString()}

---

## Business Analysis

${analysis}

---

## Campaign History

*Campaign history will be recorded here as emails are generated...*
`;

    fs.writeFileSync(contextFile, contextContent);
    console.log(`✅ Created context file for ${clientId}`);

    return true;
  } catch (error) {
    console.error('Context file creation error:', error);
    return false;
  }
}

export async function POST(request) {
  try {
    const { clientId, websiteUrl, companyName } = await request.json();

    if (!clientId || !websiteUrl) {
      return NextResponse.json({
        success: false,
        error: 'Client ID and website URL required'
      }, { status: 400 });
    }

    console.log(`🔍 Analyzing business for ${clientId}: ${websiteUrl}`);

    // Fetch website content
    const websiteContent = await fetchWebsiteContent(websiteUrl);

    if (!websiteContent) {
      return NextResponse.json({
        success: false,
        error: 'Could not fetch website content'
      }, { status: 400 });
    }

    // Analyze with Claude
    const analysis = await analyzeBusiness(websiteUrl, websiteContent, companyName);

    if (!analysis) {
      return NextResponse.json({
        success: false,
        error: 'Analysis failed'
      }, { status: 500 });
    }

    // Create context file
    const contextCreated = createContextFile(clientId, websiteUrl, companyName, analysis);

    if (!contextCreated) {
      return NextResponse.json({
        success: false,
        error: 'Could not create context file'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Business analysis complete',
      analysis: analysis
    });

  } catch (error) {
    console.error('Business analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

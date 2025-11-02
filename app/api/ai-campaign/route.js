import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Use Claude AI to research visitor behavior and generate
 * personalized, value-based marketing campaigns
 */
export async function POST(request) {
  try {
    const { visitor, company_context } = await request.json();

    if (!visitor) {
      return NextResponse.json({
        success: false,
        error: 'Visitor data required'
      }, { status: 400 });
    }

    console.log(`🤖 Claude analyzing visitor: ${visitor.email || visitor.id}`);

    // Prepare visitor behavior data for Claude
    const visitorBehavior = {
      pages_visited: visitor.pages?.map(p => ({
        url: p.url,
        title: p.title,
        time_spent: p.total_time,
        scroll_depth: p.max_scroll,
        visits: p.visits
      })) || [],
      total_sessions: visitor.total_sessions || 1,
      total_events: visitor.total_events || 0,
      engagement_indicators: {
        high_scroll: visitor.pages?.some(p => p.max_scroll > 75),
        multiple_visits: (visitor.total_sessions || 1) > 1,
        spent_significant_time: visitor.pages?.some(p => p.total_time > 60),
        clicked_multiple_items: visitor.total_events > 10
      }
    };

    // Use Claude to analyze and create campaign
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      temperature: 0.8,
      messages: [{
        role: 'user',
        content: `You are an expert email marketer who creates highly personalized, value-driven email campaigns.

VISITOR BEHAVIOR DATA:
${JSON.stringify(visitorBehavior, null, 2)}

VISITOR CONTACT INFO:
- Name: ${visitor.name || 'Unknown'}
- Email: ${visitor.email || 'Unknown'}

COMPANY CONTEXT:
${company_context || 'A B2B SaaS company offering visitor tracking and remarketing solutions'}

YOUR TASK:
1. Analyze the visitor's behavior and determine their buying intent (research phase, comparison shopping, ready to buy, etc.)
2. Determine the best campaign type (nurture, demo request, pricing discussion, case study, etc.)
3. Write a highly personalized email that:
   - Sounds completely HUMAN (conversational, friendly, not salesy)
   - Focuses on VALUE and benefits for them (not what they did on the site)
   - Creates urgency and drives ACTION
   - NEVER mentions metrics like "you spent X seconds" or "you scrolled X%"
   - Feels like it's from a real person who genuinely wants to help
   - Is 3-5 paragraphs max (short and punchy)

CRITICAL RULES:
- NO robotic language like "I noticed you visited our pricing page"
- NO metrics like "you spent 50 seconds"
- Focus on THEIR problems and how we can help solve them
- Make it feel like a 1-on-1 conversation
- Include a clear, simple call-to-action
- Sign it from a real person

OUTPUT FORMAT (JSON):
{
  "campaign_type": "demo_request" | "pricing_discussion" | "nurture" | "case_study" | "feature_highlight",
  "intent_analysis": "brief analysis of their buying intent",
  "email_subject": "compelling subject line",
  "email_body": "the full email body",
  "recommended_followup_days": number of days before follow-up,
  "priority": "high" | "medium" | "low"
}`
      }]
    });

    // Parse Claude's response
    const responseText = message.content[0].text;
    let campaignData;

    try {
      // Extract JSON from response (Claude might wrap it in markdown)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        campaignData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', parseError);
      // Fallback response
      campaignData = {
        campaign_type: 'nurture',
        intent_analysis: 'Visitor showed interest in the product',
        email_subject: 'Quick question about your goals',
        email_body: responseText,
        recommended_followup_days: 3,
        priority: 'medium'
      };
    }

    // Create campaign object
    const campaign = {
      id: `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      visitor_id: visitor.id,
      visitor_email: visitor.email,
      visitor_name: visitor.name,
      campaign_type: campaignData.campaign_type,
      intent_analysis: campaignData.intent_analysis,
      priority: campaignData.priority,
      email: {
        subject: campaignData.email_subject,
        body: campaignData.email_body,
        to: visitor.email,
        from: 'Jordan @ Attrios',
        generated_by: 'claude-ai',
        personalization_data: {
          pages_visited: visitorBehavior.pages_visited.length,
          engagement_level: campaignData.priority,
          campaign_type: campaignData.campaign_type
        }
      },
      recommended_followup_days: campaignData.recommended_followup_days,
      trigger_type: determineTriggerType(campaignData.campaign_type),
      created_at: new Date().toISOString(),
      status: 'generated'
    };

    console.log(`✅ Claude generated ${campaignData.campaign_type} campaign for ${visitor.email}`);
    console.log(`📧 Subject: "${campaignData.email_subject}"`);

    return NextResponse.json({
      success: true,
      campaign,
      ai_analysis: campaignData.intent_analysis
    });

  } catch (error) {
    console.error('❌ AI Campaign error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

function determineTriggerType(campaignType) {
  const mapping = {
    'demo_request': 'high_engagement',
    'pricing_discussion': 'high_engagement',
    'nurture': 'returning_visitor',
    'case_study': 'research_phase',
    'feature_highlight': 'abandoned_page'
  };
  return mapping[campaignType] || 'high_engagement';
}

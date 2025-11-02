import { NextResponse } from 'next/server';

// Simulated AI email generation (in production, use Claude/OpenAI API)
export async function POST(request) {
  try {
    const { visitor, trigger_type } = await request.json();

    // Generate personalized email based on visitor behavior
    const email = generatePersonalizedEmail(visitor, trigger_type);

    return NextResponse.json({
      success: true,
      email
    });

  } catch (error) {
    console.error('Email generation error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

function generatePersonalizedEmail(visitor, triggerType) {
  const name = visitor.name || visitor.email?.split('@')[0] || 'there';

  // Analyze visitor behavior
  const totalTime = visitor.pages?.reduce((sum, p) => sum + (p.total_time || 0), 0) || 0;
  const avgScroll = visitor.pages?.reduce((sum, p) => sum + (p.max_scroll || 0), 0) / (visitor.pages?.length || 1) || 0;
  const mostViewedPage = visitor.pages?.sort((a, b) => b.visits - a.visits)[0];
  const clickedItems = visitor.pages?.flatMap(p => p.clicks || []).map(c => c.text).filter(Boolean) || [];

  let subject = '';
  let body = '';
  let tone = 'professional';

  // Different email templates based on trigger type
  switch (triggerType) {
    case 'abandoned_page':
      subject = `${name}, still interested in ${mostViewedPage?.title || 'our offering'}?`;
      body = `Hey ${name},

I noticed you were checking out ${mostViewedPage?.title || 'our page'} earlier. You spent ${totalTime} seconds looking through it and ${avgScroll > 50 ? 'seemed pretty engaged' : 'started exploring'}.

${clickedItems.length > 0 ? `I saw you were particularly interested in "${clickedItems[0]}" - that's one of our most popular features.` : ''}

Was there something specific you wanted to know more about? I'm happy to answer any questions or set up a quick call.

Best,
Your Remarketing AI`;
      tone = 'friendly';
      break;

    case 'high_engagement':
      subject = `${name}, looks like you're interested - let's talk!`;
      body = `Hi ${name},

I noticed you spent ${totalTime} seconds exploring our site and checked out ${visitor.pages?.length || 0} different pages. That tells me you're seriously considering this.

You seemed most interested in:
${visitor.pages?.slice(0, 3).map(p => `• ${p.title}`).join('\n') || '• Our offerings'}

${avgScroll > 75 ? `You scrolled through everything - clearly doing your research.` : `You were digging into the details.`}

Want to hop on a quick 15-minute call? I can answer any questions and see if this is the right fit for you.

Let me know!
Your Remarketing AI`;
      tone = 'consultative';
      break;

    case 'returning_visitor':
      subject = `Welcome back, ${name}! Noticed you returned...`;
      body = `Hey ${name},

Saw you came back to check us out again. That's a good sign!

Last time you were looking at ${mostViewedPage?.title || 'our offerings'}. This time you've been checking out ${visitor.pages?.[visitor.pages.length - 1]?.title || 'more details'}.

${clickedItems.length > 2 ? `I can tell you're really researching this - you've clicked on ${clickedItems.length} different things.` : ''}

Ready to move forward, or still have questions? Either way, I'm here to help.

Let's chat,
Your Remarketing AI`;
      tone = 'warm';
      break;

    case 'form_abandoned':
      subject = `${name}, did something go wrong with the form?`;
      body = `Hi ${name},

I noticed you started filling out our form but didn't finish. No worries - happens to everyone!

${visitor.email ? `I have your email (${visitor.email}), so I wanted to reach out directly.` : ''}

Was something confusing? Did you need more information first? Or maybe you just got busy?

If you're still interested, I'd love to help you out. Just reply to this email or give me a call.

Thanks,
Your Remarketing AI`;
      tone = 'helpful';
      break;

    default:
      subject = `${name}, following up on your visit`;
      body = `Hey ${name},

Wanted to reach out after seeing you on our site. You checked out ${visitor.pages?.length || 1} pages and spent ${totalTime} seconds exploring.

Is this something you're seriously considering? Happy to answer any questions or provide more details.

Best,
Your Remarketing AI`;
      tone = 'professional';
  }

  return {
    subject,
    body,
    tone,
    to: visitor.email || 'unknown@example.com',
    generated_at: new Date().toISOString(),
    visitor_id: visitor.id,
    trigger_type: triggerType,
    personalization_data: {
      total_time: totalTime,
      avg_scroll: Math.round(avgScroll),
      pages_viewed: visitor.pages?.length || 0,
      most_viewed_page: mostViewedPage?.title || 'Unknown',
      clicked_items: clickedItems.slice(0, 3),
      engagement_level: avgScroll > 75 ? 'high' : avgScroll > 50 ? 'medium' : 'low'
    }
  };
}

import { NextResponse } from 'next/server';

// Simulated AI email generation
function generatePersonalizedEmail(visitor, triggerType) {
  const name = visitor.name || visitor.email?.split('@')[0] || 'there';
  const totalTime = visitor.total_time || 120;
  const avgScroll = visitor.avg_scroll || 80;
  const pagesViewed = visitor.pages_viewed || 3;

  let subject = '';
  let body = '';

  switch (triggerType) {
    case 'abandoned_page':
      subject = `${name}, still interested in our offering?`;
      body = `Hey ${name},

I noticed you were checking out our page earlier. You spent ${totalTime} seconds looking through it and seemed pretty engaged.

Was there something specific you wanted to know more about? I'm happy to answer any questions or set up a quick call.

Best,
RemarketAI Team`;
      break;

    case 'high_engagement':
      subject = `${name}, looks like you're interested - let's talk!`;
      body = `Hi ${name},

I noticed you spent ${totalTime} seconds exploring our site and checked out ${pagesViewed} different pages. That tells me you're seriously considering this.

You scrolled through ${avgScroll}% of the content - clearly doing your research.

Want to hop on a quick 15-minute call? I can answer any questions and see if this is the right fit for you.

Let me know!
RemarketAI Team`;
      break;

    case 'returning_visitor':
      subject = `Welcome back, ${name}! Noticed you returned...`;
      body = `Hey ${name},

Saw you came back to check us out again. That's a good sign!

You've clicked on several things and really researching this.

Ready to move forward, or still have questions? Either way, I'm here to help.

Let's chat,
RemarketAI Team`;
      break;

    default:
      subject = `${name}, following up on your visit`;
      body = `Hey ${name},

Wanted to reach out after seeing you on our site. You checked out ${pagesViewed} pages and spent ${totalTime} seconds exploring.

Is this something you're seriously considering? Happy to answer any questions or provide more details.

Best,
RemarketAI Team`;
  }

  return {
    subject,
    body,
    tone: 'professional',
    to: visitor.email || 'test@example.com',
    generated_at: new Date().toISOString(),
    personalization_data: {
      total_time: totalTime,
      avg_scroll: avgScroll,
      pages_viewed: pagesViewed,
      most_viewed_page: 'Test Page',
      clicked_items: ['Button 1', 'Special Action'],
      engagement_level: avgScroll > 75 ? 'high' : avgScroll > 50 ? 'medium' : 'low'
    }
  };
}

export async function POST(request) {
  try {
    const { trigger_type = 'high_engagement' } = await request.json();

    // Create test visitor
    const testVisitor = {
      id: 'test_visitor_' + Date.now(),
      email: 'test@example.com',
      name: 'Test User',
      total_time: 150,
      avg_scroll: 85,
      pages_viewed: 4
    };

    // Generate email
    const email = generatePersonalizedEmail(testVisitor, trigger_type);

    // Create campaign
    const campaign = {
      id: `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      visitor_id: testVisitor.id,
      visitor_email: testVisitor.email,
      visitor_name: testVisitor.name,
      trigger_type: trigger_type,
      email,
      created_at: new Date().toISOString(),
      status: 'generated'
    };

    console.log(`✉️  [TEST] Generated email: "${email.subject}" for ${testVisitor.email}`);

    // Store it by calling the track API GET endpoint to add to campaigns
    // (This is a hack for testing - in production we'd use a shared data store)

    return NextResponse.json({
      success: true,
      message: 'Test campaign generated!',
      campaign
    });

  } catch (error) {
    console.error('Test campaign error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

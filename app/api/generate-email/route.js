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

  // Extract property-specific data
  const propertyData = extractPropertyData(visitor);
  const mainProperty = propertyData.length > 0 ? propertyData[0] : null;

  let subject = '';
  let body = '';
  let tone = 'professional';

  // Property-specific email templates
  if (mainProperty) {
    const propertyDetails = getPropertyDetails(mainProperty.name);

    subject = `${name} - ${mainProperty.name} ${mainProperty.imageClicks > 3 ? '(I saw you checking out the photos!)' : 'might be perfect for you'}`;

    body = `Hi ${name},

I noticed you spent time exploring ${mainProperty.name} on our website${mainProperty.imageClicks > 0 ? ` and clicked through ${mainProperty.imageClicks} property photos` : ''}. ${propertyDetails.hook}

${propertyDetails.highlights}

Based on what I saw during your visit:
${mainProperty.imageClicks > 3 ? `• You viewed multiple property images - shows you're seriously visualizing this` : ''}
${totalTime > 120 ? `• You spent ${Math.round(totalTime / 60)} minutes on site - that's real research` : ''}
${avgScroll > 75 ? `• You scrolled through ${Math.round(avgScroll)}% of the content - thorough review` : ''}
${visitor.total_sessions > 1 ? `• You've returned ${visitor.total_sessions} times - clear sign of interest` : ''}

${propertyDetails.cta}

${propertyDetails.urgency}

Want to discuss ${mainProperty.name} specifically? I can answer questions about lot availability, pricing, financing options, or schedule a property tour.

Best regards,
Haven Ground Team`;

    tone = 'sales-consultative';

  } else {
    // Generic remarketing email (no specific property viewed)
    subject = `${name} - Finding your perfect land in Texas`;
    body = `Hi ${name},

I saw you were exploring our available properties. We have some exceptional rural land opportunities across Texas that might interest you.

Based on your browsing:
• You viewed ${visitor.pages?.length || 0} pages on our site
${avgScroll > 60 ? `• You thoroughly reviewed the content (${Math.round(avgScroll)}% scroll depth)` : ''}
${visitor.total_sessions > 1 ? `• You've returned ${visitor.total_sessions} times - shows genuine interest` : ''}

Our current featured properties include:
• Oak Hill Reserve - Spacious 1-2 acre lots with Hill Country views
• Willow Valley - Mountain acreage near Breckenridge, CO
• DeSoto Estates - Prime development land with utilities

Each property offers something unique. Want to hop on a quick call to discuss what you're looking for? I can help match you with the perfect piece of land.

Best regards,
Haven Ground Team`;

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
      main_property: mainProperty?.name || 'None',
      property_image_clicks: mainProperty?.imageClicks || 0,
      engagement_level: avgScroll > 75 ? 'high' : avgScroll > 50 ? 'medium' : 'low'
    }
  };
}

// Extract which properties the visitor viewed
function extractPropertyData(visitor) {
  const propertyMap = {};

  if (visitor.all_events) {
    visitor.all_events.forEach(event => {
      if (event.property_name && event.viewing_property) {
        if (!propertyMap[event.property_name]) {
          propertyMap[event.property_name] = {
            name: event.property_name,
            slug: event.property_slug,
            views: 0,
            imageClicks: 0
          };
        }

        if (event.event_type === 'pageview') {
          propertyMap[event.property_name].views++;
        }

        if (event.click_data?.image_clicked && event.click_data?.is_property_image) {
          propertyMap[event.property_name].imageClicks++;
        }
      }
    });
  }

  return Object.values(propertyMap).sort((a, b) =>
    (b.views * 10 + b.imageClicks) - (a.views * 10 + a.imageClicks)
  );
}

// Property-specific marketing copy
function getPropertyDetails(propertyName) {
  const properties = {
    'Oak Hill': {
      hook: "Oak Hill Reserve is one of our favorite projects - spacious 1-2 acre lots with stunning Texas Hill Country views.",
      highlights: "What makes Oak Hill special:\n• Prime Hill Country location with panoramic views\n• 1-2 acre lots giving you room to breathe\n• Quick access to Austin while maintaining that rural feel\n• Utilities available (water, electric, high-speed internet)\n• Perfect for your dream home or weekend retreat",
      cta: "The Hill Country market is hot right now, and these lots don't last long.",
      urgency: "We currently have 8 lots available, but 3 are in active negotiations."
    },
    'Willow Valley': {
      hook: "Willow Valley is absolutely stunning - mountain property just 2 miles from downtown Alma, Colorado and a short drive to Breckenridge.",
      highlights: "What makes Willow Valley special:\n• 1+ acre mountain lots with lodgepole pine forest\n• Elevation living at its finest - fresh mountain air\n• Minutes from world-class skiing in Breckenridge\n• Utilities available (electric, natural gas, internet)\n• Year-round access maintained roads",
      cta: "Mountain property near Breckenridge rarely stays on the market long.",
      urgency: "Only 7 lots remaining in this phase."
    },
    'Desoto Estates': {
      hook: "DeSoto Estates offers exceptional development potential in a growing area of North Texas.",
      highlights: "What makes DeSoto Estates special:\n• Prime development land with utilities in place\n• Growing area with strong appreciation potential\n• Flexible zoning for residential or commercial\n• Easy access to major highways\n• Perfect for builders or land investors",
      cta: "This is a rare opportunity for development-ready land in this market.",
      urgency: "Interest has been high - several lots already under contract."
    }
  };

  // Default template for unknown properties
  return properties[propertyName] || {
    hook: `${propertyName} caught your attention, and I can see why - it's one of our exceptional properties.`,
    highlights: "This property offers:\n• Quality land at a competitive price\n• Great location and accessibility\n• Utilities available or nearby\n• Flexible terms and financing options",
    cta: "Properties like this don't stay available for long in today's market.",
    urgency: "Let's discuss this while it's still available."
  };
}

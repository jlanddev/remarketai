export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-gray-900 via-blue-900 to-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-20">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
              <span className="text-blue-400 text-sm font-medium">AI-POWERED REMARKETING</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-black text-white mb-6 tracking-tight">
              Remarket<span className="text-blue-500">AI</span>
            </h1>
            <p className="text-3xl text-gray-300 font-bold mb-4">
              Turn Anonymous Visitors Into Paying Customers
            </p>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              AI-powered tracking and personalized messaging that works for SaaS, E-commerce, Real Estate, and any business with a website
            </p>

            <div className="flex gap-4 justify-center mt-10">
              <a
                href="/dashboard"
                className="px-8 py-4 bg-blue-600 text-white text-lg font-bold rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-500/50"
              >
                View Live Dashboard →
              </a>
              <a
                href="#features"
                className="px-8 py-4 bg-gray-800 text-white text-lg font-bold rounded-lg hover:bg-gray-700 transition border border-gray-700"
              >
                See How It Works
              </a>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-6 mb-16">
            <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6 text-center">
              <div className="text-4xl font-black text-blue-400 mb-2">98%</div>
              <div className="text-gray-400 text-sm">Visitor Tracking Accuracy</div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6 text-center">
              <div className="text-4xl font-black text-green-400 mb-2">3.2x</div>
              <div className="text-gray-400 text-sm">Average Conversion Lift</div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6 text-center">
              <div className="text-4xl font-black text-purple-400 mb-2">24/7</div>
              <div className="text-gray-400 text-sm">AI Remarketing Active</div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6 text-center">
              <div className="text-4xl font-black text-yellow-400 mb-2">&lt;10KB</div>
              <div className="text-gray-400 text-sm">Lightweight Tracking</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black text-white mb-4">
            Everything You Need To Recover Lost Revenue
          </h2>
          <p className="text-xl text-gray-400">
            One platform. Multiple channels. Unlimited possibilities.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 hover:border-blue-500 transition">
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
              Universal Tracking
            </h3>
            <p className="text-gray-400 mb-4">
              Track every visitor action - page views, clicks, form interactions, scroll depth, and time on site. Works on any website platform.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-gray-700 rounded text-xs text-gray-300">Shopify</span>
              <span className="px-3 py-1 bg-gray-700 rounded text-xs text-gray-300">WordPress</span>
              <span className="px-3 py-1 bg-gray-700 rounded text-xs text-gray-300">Custom Sites</span>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 hover:border-purple-500 transition">
            <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
              AI Personalization
            </h3>
            <p className="text-gray-400 mb-4">
              Generate unique, highly personalized messages for every visitor based on their behavior, interests, and engagement patterns.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-gray-700 rounded text-xs text-gray-300">GPT-4</span>
              <span className="px-3 py-1 bg-gray-700 rounded text-xs text-gray-300">Claude</span>
              <span className="px-3 py-1 bg-gray-700 rounded text-xs text-gray-300">Learning AI</span>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 hover:border-green-500 transition">
            <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
              Multi-Channel Outreach
            </h3>
            <p className="text-gray-400 mb-4">
              Reach customers where they are - email, SMS, Slack, WhatsApp. All automated and perfectly timed by AI.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-gray-700 rounded text-xs text-gray-300">Email</span>
              <span className="px-3 py-1 bg-gray-700 rounded text-xs text-gray-300">SMS</span>
              <span className="px-3 py-1 bg-gray-700 rounded text-xs text-gray-300">Slack</span>
            </div>
          </div>
        </div>

        {/* Quick Start */}
        <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-2xl p-10">
          <h2 className="text-3xl font-bold text-white mb-8">
            Get Started in 60 Seconds
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="w-10 h-10 bg-blue-500 text-white rounded-lg flex items-center justify-center font-bold text-xl mb-4">
                1
              </div>
              <h4 className="text-white font-bold mb-2">Add Tracking Script</h4>
              <p className="text-gray-400 text-sm mb-3">
                Paste one line of code into your website
              </p>
              <code className="block p-4 bg-black rounded border border-gray-700 text-xs text-green-400 font-mono overflow-x-auto">
                {`<script src="http://localhost:3003/track.js?id=demo"></script>`}
              </code>
            </div>

            <div>
              <div className="w-10 h-10 bg-purple-500 text-white rounded-lg flex items-center justify-center font-bold text-xl mb-4">
                2
              </div>
              <h4 className="text-white font-bold mb-2">Configure AI Rules</h4>
              <p className="text-gray-400 text-sm">
                Set triggers for abandoned carts, high engagement, form exits, and more
              </p>
            </div>

            <div>
              <div className="w-10 h-10 bg-green-500 text-white rounded-lg flex items-center justify-center font-bold text-xl mb-4">
                3
              </div>
              <h4 className="text-white font-bold mb-2">Watch Revenue Grow</h4>
              <p className="text-gray-400 text-sm">
                AI automatically reaches out to visitors and converts them into customers
              </p>
            </div>
          </div>

          <div className="mt-10 flex gap-4">
            <a
              href="/dashboard"
              className="px-8 py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-500/30"
            >
              Launch Dashboard →
            </a>
            <a
              href="#"
              className="px-8 py-4 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition border border-gray-600"
            >
              View Documentation
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-gray-500">
          <p className="text-sm">
            Built with Next.js 16 + AI • Running on <span className="text-blue-400 font-mono">localhost:3003</span>
          </p>
          <p className="text-xs mt-2">
            Professional remarketing platform inspired by industry leaders
          </p>
        </div>
      </div>
    </div>
  )
}

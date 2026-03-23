export function ScoringSection() {
  return (
    <section id="scoring" className="mb-16">
      <h2 className="text-4xl font-black text-slate-900 mb-6">
        <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          AI Readiness Scoring
        </span>
      </h2>
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border-2 border-blue-200 p-8 shadow-lg mb-6">
        <h3 className="text-2xl font-bold text-slate-900 mb-4">
          📊 One Number, Complete Picture
        </h3>
        <p className="text-slate-700 mb-4">
          Get a unified <strong>0-100 score</strong> combining tools with proven
          default weights:
        </p>
        <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm mb-6">
          <div>npx @aiready/cli scan ./src --score</div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-lg font-bold text-slate-900 mb-3">
              Default Weights
            </h4>
            <ul className="space-y-2 text-slate-700">
              <li className="flex justify-between">
                <span>Pattern Detection:</span>{' '}
                <span className="font-bold">40%</span>
              </li>
              <li className="flex justify-between">
                <span>Context Analysis:</span>{' '}
                <span className="font-bold">35%</span>
              </li>
              <li className="flex justify-between">
                <span>Consistency:</span> <span className="font-bold">25%</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-900 mb-3">
              Rating Scale
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="font-semibold">90-100 Excellent</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="font-semibold">75-89 Good</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="font-semibold">60-74 Fair</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="font-semibold">40-59 Needs Work</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-800"></div>
                <span className="font-semibold">0-39 Critical</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-lg mb-6">
        <h3 className="text-2xl font-bold text-slate-900 mb-4">
          🎯 Customizable Weights
        </h3>
        <p className="text-slate-700 mb-4">
          Adjust weights to match your team's priorities:
        </p>
        <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm mb-4">
          <div className="mb-2"># Prioritize pattern detection</div>
          <div className="mb-4">
            aiready scan . --score --weights
            patterns:60,context:25,consistency:15
          </div>
          <div className="mb-2"># Equal weighting</div>
          <div>
            aiready scan . --score --weights
            patterns:33,context:33,consistency:34
          </div>
        </div>
      </div>
    </section>
  );
}

export function MetricsSection() {
  return (
    <section id="metrics" className="mb-16">
      <h2 className="text-4xl font-black text-slate-900 mb-6">
        Understanding Metrics
      </h2>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md">
          <h3 className="text-xl font-bold text-slate-900 mb-3">
            🧩 Knowledge Concentration
          </h3>
          <p className="text-slate-600 text-sm mb-4">
            Measures "bus factor" for AI training. High concentration means AI
            only learns from one person's patterns.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full w-[65%]"></div>
            </div>
            <span className="text-sm font-bold text-amber-600">65% Risk</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md">
          <h3 className="text-xl font-bold text-slate-900 mb-3">
            📉 Tech Debt Interest
          </h3>
          <p className="text-slate-600 text-sm mb-4">
            Calculates the "interest" paid every time an AI assistant uses a
            confusing pattern.
          </p>
          <div className="text-2xl font-black text-red-600">
            $1,240
            <span className="text-sm font-normal text-slate-500 ml-1">
              /mo waste
            </span>
          </div>
        </div>
      </div>
      <div className="mt-8 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div>
          <h3 className="text-2xl font-bold text-white mb-2">
            Measure what matters to your team
          </h3>
          <p className="text-slate-400">
            Need a custom metric for data quality, pipeline standards, or
            security?
          </p>
        </div>
        <a
          href="https://github.com/caopengau/aiready/blob/main/packages/cli/docs/SPOKE_GUIDE.md"
          className="bg-white text-slate-900 px-8 py-4 rounded-xl font-bold hover:bg-slate-100 transition-all whitespace-nowrap"
        >
          Build New Metrics →
        </a>
      </div>
    </section>
  );
}

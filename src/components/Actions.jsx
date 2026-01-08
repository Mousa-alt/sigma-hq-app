import Icon from './Icon';

export default function Actions() {
  const actions = [
    { 
      id: 1, 
      name: 'Generate Progress Report', 
      description: 'Create a weekly progress report from site data',
      icon: 'file-text',
      color: 'blue',
      status: 'ready'
    },
    { 
      id: 2, 
      name: 'Extract BOQ Summary', 
      description: 'Pull quantities from latest BOQ files',
      icon: 'calculator',
      color: 'emerald',
      status: 'ready'
    },
    { 
      id: 3, 
      name: 'Compare Shop Drawings', 
      description: 'AI-powered comparison of drawing revisions',
      icon: 'git-compare',
      color: 'purple',
      status: 'coming'
    },
    { 
      id: 4, 
      name: 'Invoice Tracker', 
      description: 'Track and summarize all contractor invoices',
      icon: 'receipt',
      color: 'orange',
      status: 'coming'
    },
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-500 border-blue-200',
      emerald: 'bg-emerald-50 text-emerald-500 border-emerald-200',
      purple: 'bg-purple-50 text-purple-500 border-purple-200',
      orange: 'bg-orange-50 text-orange-500 border-orange-200',
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="h-full flex flex-col pb-40 sm:pb-24 overflow-y-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-0.5 sm:mb-1">Quick Actions</h2>
        <p className="text-xs sm:text-sm text-slate-500">AI-powered automations for your project</p>
      </div>

      {/* Actions grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {actions.map(action => (
          <div
            key={action.id}
            className={`p-4 sm:p-5 bg-white border rounded-xl transition-all ${
              action.status === 'ready' 
                ? 'border-slate-200 hover:border-blue-300 hover:shadow-md cursor-pointer' 
                : 'border-slate-100 opacity-60'
            }`}
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <div className={`p-2 sm:p-3 rounded-xl ${getColorClasses(action.color)}`}>
                <Icon name={action.icon} size={18} className="sm:w-5 sm:h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 sm:mb-1 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-medium text-slate-900">{action.name}</h3>
                  {action.status === 'coming' && (
                    <span className="px-1.5 sm:px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] sm:text-[10px] uppercase tracking-wide">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500">{action.description}</p>
              </div>
              {action.status === 'ready' && (
                <Icon name="chevron-right" size={14} className="text-slate-400 flex-shrink-0" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Suggestion box */}
      <div className="mt-6 sm:mt-8 p-4 sm:p-5 bg-slate-50 border border-slate-100 rounded-xl">
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
          <Icon name="lightbulb" size={16} className="text-amber-500" />
          <span className="text-xs sm:text-sm font-medium text-slate-900">Suggest an Action</span>
        </div>
        <p className="text-[10px] sm:text-xs text-slate-500 mb-3 sm:mb-4">
          Have an idea for an automation that would help your workflow? Let us know!
        </p>
        <button className="px-3 sm:px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] sm:text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          Submit Suggestion
        </button>
      </div>
    </div>
  );
}

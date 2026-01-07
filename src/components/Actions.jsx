import Icon from './Icon';

export default function Actions() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-6">
        <Icon name="zap" size={32} className="text-amber-500" />
      </div>
      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Coming Soon</h2>
      <p className="text-xs text-slate-400 font-bold uppercase mt-3 tracking-widest">
        Automation workflows for BoQs and Invoices
      </p>
    </div>
  );
}

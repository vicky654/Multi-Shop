import { memo } from 'react';
import { Zap, Printer, User, Clock } from 'lucide-react';
import useBillingSettingsStore from '../../store/billingSettingsStore';

const PAYMENT_OPTIONS = [
  { key: 'cash',   label: 'Cash'   },
  { key: 'card',   label: 'Card'   },
  { key: 'upi',    label: 'UPI'    },
  { key: 'credit', label: 'Credit' },
];

/**
 * AutoBillSettings — collapsible panel for fast-billing preferences.
 *
 * Lives in the billing page sidebar (below the cart). Renders as a
 * compact toggle list — no modals, no navigation away from billing.
 */
const AutoBillSettings = memo(function AutoBillSettings() {
  const {
    skipConfirmation, autoPaymentMode, autoAddFirstResult,
    autoPrint, autoWalkIn, update,
  } = useBillingSettingsStore();

  const toggle = (key) => update({ [key]: !useBillingSettingsStore.getState()[key] });

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-100">
        <Zap className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Fast Billing</span>
      </div>

      <div className="divide-y divide-gray-50">
        {/* Auto-add first result */}
        <Row
          label="Auto-add on Enter"
          description="First result added instantly"
          active={autoAddFirstResult}
          onToggle={() => toggle('autoAddFirstResult')}
          icon={<Zap className="w-3 h-3" />}
        />

        {/* Skip confirmation */}
        <Row
          label="Skip pay confirmation"
          description="Ctrl+Enter charges immediately"
          active={skipConfirmation}
          onToggle={() => toggle('skipConfirmation')}
          icon={<Zap className="w-3 h-3" />}
        />

        {/* Walk-in customer */}
        <Row
          label="Walk-in customer"
          description="Skip customer selection"
          active={autoWalkIn}
          onToggle={() => toggle('autoWalkIn')}
          icon={<User className="w-3 h-3" />}
        />

        {/* Auto print */}
        <Row
          label="Auto-print receipt"
          description="Print & reset after payment"
          active={autoPrint}
          onToggle={() => toggle('autoPrint')}
          icon={<Printer className="w-3 h-3" />}
        />

        {/* Default payment mode */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-600">Default payment</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {PAYMENT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => update({ autoPaymentMode: key })}
                className={`py-1 rounded-lg text-[10px] border transition-all ${
                  autoPaymentMode === key
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

function Row({ label, description, active, onToggle, icon }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="flex items-center gap-2">
        <span className={`${active ? 'text-blue-500' : 'text-gray-300'}`}>{icon}</span>
        <div>
          <p className="text-xs text-gray-700 leading-none">{label}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      {/* Toggle pill */}
      <div className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${active ? 'bg-blue-500' : 'bg-gray-200'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
    </button>
  );
}

export default AutoBillSettings;

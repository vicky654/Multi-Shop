import { memo } from 'react';
import { MessageCircle, Send, Bell, Signal, Wifi, Battery } from 'lucide-react';

const SAMPLE = { name: 'Vicky', shop: 'My Shop', due: '₹500', amount: '₹2,500' };

const personalizeSample = (msg = '') =>
  msg
    .replace(/\{name\}/gi,   SAMPLE.name)
    .replace(/\{shop\}/gi,   SAMPLE.shop)
    .replace(/\{due\}/gi,    SAMPLE.due)
    .replace(/\{amount\}/gi, SAMPLE.amount);

// ── WhatsApp bubble ───────────────────────────────────────────────────────────
function WhatsAppPreview({ message, shopName }) {
  const preview = personalizeSample(message);
  const time    = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-[#111b21] rounded-2xl overflow-hidden shadow-2xl max-w-xs mx-auto">
      {/* Status bar */}
      <div className="bg-[#1f2c34] flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[#e9edef] text-[11px] font-semibold">{time}</span>
        <div className="flex items-center gap-1">
          <Signal className="w-3 h-3 text-[#e9edef]" />
          <Wifi    className="w-3 h-3 text-[#e9edef]" />
          <Battery className="w-3.5 h-3.5 text-[#e9edef]" />
        </div>
      </div>

      {/* WhatsApp header */}
      <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 border-b border-[#2a3942]">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {shopName?.[0]?.toUpperCase() || 'S'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#e9edef] text-sm font-semibold truncate">{shopName || 'Your Shop'}</p>
          <p className="text-[#00a884] text-xs">Business Account</p>
        </div>
        <MessageCircle className="w-5 h-5 text-[#8696a0]" />
      </div>

      {/* Chat area */}
      <div className="bg-[#0b1117] px-3 py-4 min-h-28">
        <div className="bg-[#202c33] rounded-xl rounded-tl-none px-3.5 py-2.5 max-w-[85%] shadow">
          <p className="text-[#e9edef] text-[13px] leading-relaxed whitespace-pre-line break-words">
            {preview}
          </p>
          <div className="flex items-center justify-end gap-1 mt-1.5">
            <span className="text-[#8696a0] text-[10px]">{time}</span>
            <span className="text-[#53bdeb] text-[10px]">✓✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SMS bubble ────────────────────────────────────────────────────────────────
function SmsPreview({ message }) {
  const preview = personalizeSample(message);
  const smsCount = Math.ceil((message || '').length / 160) || 1;

  return (
    <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl max-w-xs mx-auto">
      {/* Status bar */}
      <div className="bg-gray-900 flex items-center justify-between px-4 py-1.5">
        <span className="text-gray-300 text-[11px] font-semibold">9:41 AM</span>
        <div className="flex items-center gap-1">
          <Signal className="w-3 h-3 text-gray-300" />
          <Battery className="w-3.5 h-3.5 text-gray-300" />
        </div>
      </div>

      {/* SMS app header */}
      <div className="bg-blue-600 px-4 py-3 flex items-center gap-2">
        <Send className="w-4 h-4 text-white" />
        <p className="text-white text-sm font-bold">Messages</p>
      </div>

      {/* Message */}
      <div className="bg-gray-100 p-4">
        <div className="flex justify-end">
          <div className="bg-blue-500 rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] shadow">
            <p className="text-white text-[13px] leading-relaxed whitespace-pre-line break-words">
              {preview}
            </p>
          </div>
        </div>
        <div className="flex justify-end mt-1.5 gap-2">
          <span className="text-gray-400 text-[10px]">{(message || '').length} chars</span>
          <span className="text-gray-400 text-[10px]">·</span>
          <span className="text-gray-400 text-[10px]">{smsCount} SMS credit{smsCount > 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}

// ── Push notification ─────────────────────────────────────────────────────────
function PushPreview({ subject, message }) {
  const preview = personalizeSample(message);

  return (
    <div className="max-w-xs mx-auto space-y-3">
      {/* Phone mockup */}
      <div className="bg-gradient-to-b from-blue-900 to-indigo-900 rounded-3xl p-4 shadow-2xl">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-1 bg-white/30 rounded-full" />
        </div>
        <p className="text-center text-white/50 text-xs mb-4">Lock Screen</p>

        {/* Notification card */}
        <div className="bg-white/90 backdrop-blur rounded-2xl px-4 py-3.5 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
              <Bell className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-bold text-gray-900 text-[13px] truncate">
                  {subject || 'MultiShop Notification'}
                </p>
                <span className="text-gray-400 text-[10px] shrink-0 ml-1">now</span>
              </div>
              <p className="text-gray-600 text-[12px] mt-0.5 line-clamp-3 leading-relaxed">
                {preview}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default memo(function MessagePreview({ channel, message, subject, shopName }) {
  if (!message?.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-300">
        <MessageCircle className="w-10 h-10 mb-2 opacity-40" />
        <p className="text-sm">Type a message to see preview</p>
      </div>
    );
  }

  const labels = { whatsapp: 'WhatsApp Preview', sms: 'SMS Preview', push: 'Push Preview' };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          {labels[channel] || 'Preview'}
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {channel === 'whatsapp' && <WhatsAppPreview message={message} shopName={shopName} />}
      {channel === 'sms'      && <SmsPreview      message={message} />}
      {channel === 'push'     && <PushPreview      subject={subject} message={message} />}

      <p className="text-center text-[11px] text-gray-400">
        Preview uses sample data — actual messages are personalised per customer
      </p>
    </div>
  );
});

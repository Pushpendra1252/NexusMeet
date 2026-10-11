import React, { useState } from 'react';
import { X, Copy, Check, Link as LinkIcon, ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../common/Toast';

export const NewMeetingModal = ({ isOpen, onClose, meetingCode }) => {
  const [copied, setCopied] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const meetingUrl = `${window.location.origin}/room/${meetingCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(meetingUrl);
    setCopied(true);
    addToast('Meeting link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleJoinNow = () => {
    onClose();
    navigate(`/room/${meetingCode}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-dark-card border border-dark-border rounded-2xl shadow-2xl overflow-hidden p-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-panel transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/30 flex items-center justify-center text-primary-400">
            <LinkIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Here's your meeting link</h3>
            <p className="text-xs text-dark-muted">Share this link with people you want to meet with</p>
          </div>
        </div>

        {/* Meeting Link Box */}
        <div className="mt-4 p-3 bg-dark-panel rounded-xl border border-dark-border flex items-center justify-between gap-2">
          <span className="text-sm font-mono text-slate-200 truncate select-all">{meetingUrl}</span>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              copied
                ? 'bg-accent-emerald text-white'
                : 'bg-primary-600 hover:bg-primary-500 text-white shadow-glow-primary'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
        </div>

        {/* Security / Phase Info Note */}
        <div className="mt-4 p-3 rounded-xl bg-primary-500/5 border border-primary-500/15 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-300 leading-relaxed">
            Unique meeting room generated. Anyone with this link or code <span className="font-mono text-primary-300 font-semibold">{meetingCode}</span> will be able to join.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-dark-panel transition-colors"
          >
            Done
          </button>
          <button
            onClick={handleJoinNow}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-500 shadow-glow-primary transition-all"
          >
            Join Preview Room
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

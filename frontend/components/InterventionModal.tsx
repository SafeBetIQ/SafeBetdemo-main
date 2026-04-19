'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Coffee, UserX, Book, Phone, Eye, Clock, MessageSquare, Mail, Smartphone, Wifi, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Loader, ShieldAlert, TrendingDown, TriangleAlert } from 'lucide-react';

export interface InterventionData {
  interventionType: string;
  deliveryMethod: string;
  deliveryMethods: string[];
  message: string;
  customMessage?: string;
}

interface InterventionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
  casinoName?: string;
  riskScore: number;
  triggerReason: string;
  onSubmit: (data: InterventionData) => void | Promise<void>;
}

const INTERVENTION_TYPES = [
  {
    value: 'break_suggestion',
    label: 'Suggest Break',
    icon: Coffee,
    description: 'Recommend a short break from play',
    minRisk: 0,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
  },
  {
    value: 'session_limit',
    label: 'Session Limit',
    icon: Clock,
    description: 'Advise setting time or spend limits',
    minRisk: 40,
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
  },
  {
    value: 'cooling_off',
    label: 'Cooling-Off Period',
    icon: TrendingDown,
    description: '24–72 hour voluntary pause',
    minRisk: 60,
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
  },
  {
    value: 'contact_support',
    label: 'Contact Support',
    icon: Phone,
    description: 'Connect with a responsible gambling counselor',
    minRisk: 70,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
  },
  {
    value: 'self_exclusion',
    label: 'Self-Exclusion',
    icon: UserX,
    description: 'Long-term or permanent exclusion option',
    minRisk: 80,
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-300',
  },
  {
    value: 'manual_compliance',
    label: 'Compliance Review',
    icon: ShieldAlert,
    description: 'Escalate to compliance team for manual review',
    minRisk: 85,
    color: 'text-red-800',
    bg: 'bg-red-100 border-red-400',
  },
  {
    value: 'educational_content',
    label: 'Education',
    icon: Book,
    description: 'Share responsible gambling resources',
    minRisk: 0,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
  },
];

const DELIVERY_METHODS = [
  { value: 'in_app', label: 'In-App Notification', icon: Wifi, description: 'Displayed inside the platform' },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, description: 'Via WhatsApp Business API' },
  { value: 'sms', label: 'SMS', icon: Smartphone, description: 'Via Twilio SMS' },
  { value: 'email', label: 'Email', icon: Mail, description: 'Via SendGrid / SMTP' },
];

const getRiskConfig = (score: number) => {
  if (score >= 80) return { label: 'Critical', color: 'text-red-700', bg: 'bg-red-50 border-red-200', badge: 'destructive' as const };
  if (score >= 60) return { label: 'High', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', badge: 'default' as const };
  if (score >= 40) return { label: 'Moderate', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', badge: 'secondary' as const };
  return { label: 'Low', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', badge: 'outline' as const };
};

const getSuggestedType = (score: number): string => {
  if (score >= 90) return 'manual_compliance';
  if (score >= 80) return 'contact_support';
  if (score >= 70) return 'cooling_off';
  if (score >= 55) return 'session_limit';
  if (score >= 40) return 'break_suggestion';
  return 'educational_content';
};

export function InterventionModal({
  open,
  onOpenChange,
  playerName,
  casinoName = 'SafeBet IQ',
  riskScore,
  triggerReason,
  onSubmit,
}: InterventionModalProps) {
  const [interventionType, setInterventionType] = useState(() => getSuggestedType(riskScore));
  const [deliveryMethods, setDeliveryMethods] = useState<string[]>(['in_app']);
  const [editableMessage, setEditableMessage] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const helplineFooter = `\n\n────────────────────────────\nNational Gambling Helpline: 0800 006 008\nAvailable 24/7 | Free & Confidential`;

  const getTemplate = (type: string): string => {
    const templates: Record<string, string> = {
      break_suggestion: `Message from ${casinoName} Responsible Gaming Team\n\nHi ${playerName},\n\nWe noticed you've been playing for a while. Regular breaks help maintain balance and keep gaming enjoyable.\n\nWould you like to:\n• Take a 15-minute break now\n• Set a session reminder\n• Review your recent activity\n\nRemember, gambling should always be fun and within your means.${helplineFooter}`,
      session_limit: `Message from ${casinoName} Responsible Gaming Team\n\nHi ${playerName},\n\nYour current session has been active for an extended period. We care about your wellbeing.\n\nYou can set limits for:\n• Session duration (time)\n• Spending amount per session\n• Daily and weekly budgets\n\nThese tools help you stay in control. Would you like to review your limit settings?${helplineFooter}`,
      cooling_off: `Message from ${casinoName} Responsible Gaming Team\n\nHi ${playerName},\n\nWe've identified some patterns that suggest a break may be beneficial for you right now.\n\nConsider a cooling-off period:\n• 24 hours — Short reset\n• 72 hours — Extended pause\n• 7 days — Full break\n\nThis is a proactive step to maintain healthy gaming habits. You can activate this at any time.${helplineFooter}`,
      contact_support: `Message from ${casinoName} Responsible Gaming Team\n\nHi ${playerName},\n\nOur responsible gaming support team would like to connect with you.\n\nFree confidential services available:\n• Speak with a trained gambling counselor\n• Access personalized responsible gaming tools\n• Get support for you and your family\n\nReach out through in-app support or contact the helpline below at any time.${helplineFooter}`,
      self_exclusion: `Message from ${casinoName} Responsible Gaming Team\n\nHi ${playerName},\n\nIf you feel you need stronger support, self-exclusion is available to you.\n\nOptions include:\n• 1 month exclusion\n• 3 months exclusion\n• 6 months exclusion\n• Permanent exclusion\n\nThis is a serious commitment to your wellbeing and can be arranged confidentially. Our team is here to help.${helplineFooter}`,
      manual_compliance: `URGENT: Responsible Gambling Compliance Notice\n\nDear ${playerName},\n\nOur compliance team has reviewed your recent account activity and would like to speak with you directly.\n\nThis is a mandatory responsible gambling check in accordance with the National Gambling Act. A member of our team will be in contact shortly.\n\nYou may also contact us immediately:${helplineFooter}`,
      educational_content: `Message from ${casinoName} Responsible Gaming Team\n\nHi ${playerName},\n\nWe'd like to share some helpful resources to support informed and balanced gaming:\n\n• Understanding your gambling patterns\n• How to set personal limits effectively\n• Recognizing early warning signs\n• Maintaining balance in your daily life\n\nKnowledge is powerful. These tools help you make informed decisions.${helplineFooter}`,
    };
    return templates[type] || templates.break_suggestion;
  };

  useEffect(() => {
    setEditableMessage(getTemplate(interventionType));
  }, [interventionType, playerName, casinoName]);

  useEffect(() => {
    if (open) {
      setInterventionType(getSuggestedType(riskScore));
      setDeliveryMethods(['in_app']);
      setCustomNote('');
      setShowPreview(false);
      setSubmitted(false);
    }
  }, [open, riskScore]);

  const toggleDelivery = (method: string) => {
    setDeliveryMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const getFinalMessage = () => {
    let msg = editableMessage;
    if (customNote.trim()) {
      msg += `\n\n---\nPersonal note from support team:\n${customNote}`;
    }
    return msg;
  };

  const handleSubmit = async () => {
    if (deliveryMethods.length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit({
        interventionType,
        deliveryMethod: deliveryMethods[0],
        deliveryMethods,
        message: getFinalMessage(),
        customMessage: customNote || undefined,
      });
      setSubmitted(true);
      setTimeout(() => onOpenChange(false), 1200);
    } finally {
      setSubmitting(false);
    }
  };

  const riskCfg = getRiskConfig(riskScore);
  const suggestedType = getSuggestedType(riskScore);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-5 w-5 text-primary shrink-0" />
            Responsible Gambling Intervention
          </DialogTitle>
          <DialogDescription>
            AI-recommended intervention — all actions are logged for compliance
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500" />
            <p className="text-base font-semibold">Intervention dispatched</p>
            <p className="text-sm text-muted-foreground">Logged and queued for delivery via {deliveryMethods.join(', ')}</p>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Player Risk Banner */}
            <div className={`rounded-lg border p-3.5 ${riskCfg.bg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Player</div>
                  <div className="font-semibold">{playerName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{triggerReason}</div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold tabular-nums ${riskCfg.color}`}>{riskScore}</div>
                  <Badge variant={riskCfg.badge} className="text-xs mt-1">{riskCfg.label} Risk</Badge>
                </div>
              </div>
            </div>

            {/* Intervention Type */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">
                Intervention Type
                {suggestedType === interventionType && (
                  <span className="ml-2 text-xs font-normal text-primary">AI recommended</span>
                )}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {INTERVENTION_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = interventionType === type.value;
                  const isSuggested = suggestedType === type.value;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setInterventionType(type.value)}
                      className={`relative text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground/40'
                      }`}
                    >
                      {isSuggested && (
                        <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-primary bg-primary/10 px-1 rounded">AI</span>
                      )}
                      <div className="flex items-center gap-2 mb-0.5">
                        <Icon className={`h-3.5 w-3.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-xs font-semibold">{type.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">{type.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Delivery Channels */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">
                Delivery Channels
                <span className="ml-2 text-xs font-normal text-muted-foreground">Select one or more</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {DELIVERY_METHODS.map((method) => {
                  const Icon = method.icon;
                  const isSelected = deliveryMethods.includes(method.value);
                  return (
                    <button
                      key={method.value}
                      onClick={() => toggleDelivery(method.value)}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`flex h-6 w-6 items-center justify-center rounded ${isSelected ? 'bg-primary text-white' : 'bg-muted'}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold">{method.label}</div>
                          <div className="text-[11px] text-muted-foreground">{method.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {deliveryMethods.length === 0 && (
                <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Select at least one delivery channel
                </p>
              )}
            </div>

            <Separator />

            {/* Message */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Message Content
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button" variant="ghost" size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setEditableMessage(getTemplate(interventionType))}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button" variant="ghost" size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setShowPreview((v) => !v)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {showPreview ? 'Edit' : 'Preview'}
                  </Button>
                </div>
              </div>
              {showPreview ? (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b">
                    <span className="text-xs font-semibold text-primary">{casinoName} Support</span>
                    <div className="flex gap-1">
                      {deliveryMethods.map((m) => (
                        <Badge key={m} variant="outline" className="text-[10px] capitalize">{m.replace('_', ' ')}</Badge>
                      ))}
                    </div>
                  </div>
                  <pre className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-sans">
                    {getFinalMessage()}
                  </pre>
                </div>
              ) : (
                <Textarea
                  value={editableMessage}
                  onChange={(e) => setEditableMessage(e.target.value)}
                  rows={7}
                  className="resize-none font-mono text-xs"
                />
              )}
            </div>

            {/* Custom Note */}
            <div>
              <Label className="text-sm font-semibold mb-1.5 block">
                Personal Note
                <span className="ml-2 text-xs font-normal text-muted-foreground">Optional — appended to message</span>
              </Label>
              <Textarea
                placeholder="Add a personal note from the support team..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            {/* Compliance Notice */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border">
              <TriangleAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                This intervention will be permanently logged in the compliance audit trail with timestamp, staff ID, delivery method, and player response. All communications comply with the National Gambling Act and POPIA requirements.
              </p>
            </div>
          </div>
        )}

        {!submitted && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || deliveryMethods.length === 0}
              className="min-w-[160px]"
            >
              {submitting ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Dispatching...
                </>
              ) : (
                <>
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Send Intervention
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, MessageSquare, Coffee, UserX, Book, Phone, Eye } from 'lucide-react';

interface InterventionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
  casinoName?: string;
  riskScore: number;
  triggerReason: string;
  onSubmit: (data: InterventionData) => void;
}

interface InterventionData {
  interventionType: string;
  deliveryMethod: string;
  message: string;
  customMessage?: string;
}

export function InterventionModal({
  open,
  onOpenChange,
  playerName,
  casinoName = 'SafeBet IQ',
  riskScore,
  triggerReason,
  onSubmit
}: InterventionModalProps) {
  const [interventionType, setInterventionType] = useState('break_suggestion');
  const [deliveryMethod, setDeliveryMethod] = useState('in_app');
  const [customMessage, setCustomMessage] = useState('');
  const [editableMessage, setEditableMessage] = useState('');

  const interventionTypes = [
    { value: 'break_suggestion', label: 'Suggest Break', icon: Coffee, description: 'Recommend a short break' },
    { value: 'session_limit', label: 'Session Limit', icon: AlertTriangle, description: 'Set time/spending limit' },
    { value: 'cooling_off', label: 'Cooling Off Period', icon: Coffee, description: '24-72 hour pause' },
    { value: 'self_exclusion', label: 'Self-Exclusion', icon: UserX, description: 'Long-term exclusion option' },
    { value: 'contact_support', label: 'Contact Support', icon: Phone, description: 'Connect with counselor' },
    { value: 'educational_content', label: 'Education', icon: Book, description: 'Share resources' }
  ];

  const deliveryMethods = [
    { value: 'in_app', label: 'In-App Notification' },
    { value: 'whatsapp', label: 'WhatsApp Message' },
    { value: 'sms', label: 'SMS Alert' },
    { value: 'email', label: 'Email' }
  ];

  const getDefaultTemplate = (type: string): string => {
    const helplineFooter = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nIf you need support, contact:\nNational Gambling Helpline: 0800 006 008\nAvailable 24/7 | Free & Confidential`;

    const templates: Record<string, string> = {
      break_suggestion: `Message from ${casinoName} Responsible Gaming Team\n\nHi ${playerName},\n\nWe've noticed you've been playing for a while. Taking regular breaks helps maintain balance and enjoyment.\n\nWould you like to:\n• Take a 15-minute break\n• Set a session reminder\n• Review your activity\n\nRemember, gambling should be fun and within your means.${helplineFooter}`,
      session_limit: `Message from ${casinoName} Responsible Gaming Team\n\nHi ${playerName},\n\nYour current session has been active for an extended period. We care about your wellbeing.\n\nYou can set limits for:\n• Session duration (time)\n• Spending amount\n• Daily/weekly budgets\n\nThese tools help you stay in control. Would you like to review your settings?${helplineFooter}`,
      cooling_off: `Message from ${casinoName} Responsible Gaming Team\n\nHi ${playerName},\n\nWe've identified some patterns that suggest a break might be beneficial.\n\nConsider a cooling-off period:\n• 24 hours - Short break\n• 72 hours - Extended pause\n• 7 days - Full reset\n\nThis is a proactive step to maintain healthy gaming habits. You can activate this anytime.${helplineFooter}`,
      self_exclusion: `Message from ${casinoName} Responsible Gaming Team\n\nHi ${playerName},\n\nIf you feel you need more support with your gaming, self-exclusion is available.\n\nOptions include:\n• 1 month exclusion\n• 3 months exclusion\n• 6 months exclusion\n• Permanent exclusion\n\nThis is a serious commitment to your wellbeing. Contact our support team 24/7 for confidential help.${helplineFooter}`,
      contact_support: `Message from ${casinoName} Responsible Gaming Team\n\nHi ${playerName},\n\nOur support team is here to help you.\n\nFree confidential services:\n• Speak with a trained counselor\n• Access responsible gaming resources\n• Get personalized support\n\nYou can reach out to us anytime through our in-app support or contact the helpline below.${helplineFooter}`,
      educational_content: `Message from ${casinoName} Responsible Gaming Team\n\nHi ${playerName},\n\nWe'd like to share some helpful resources with you:\n\n📚 Understanding Responsible Gaming\n📊 How to Track Your Activity\n🎯 Setting Personal Limits\n💚 Maintaining Balance\n\nKnowledge is power. These tools can help you make informed decisions about your gaming.${helplineFooter}`
    };

    return templates[type] || templates.break_suggestion;
  };

  useEffect(() => {
    setEditableMessage(getDefaultTemplate(interventionType));
  }, [interventionType, playerName, casinoName]);

  const getFinalMessage = () => {
    let finalMessage = editableMessage || getDefaultTemplate(interventionType);

    if (customMessage && customMessage.trim()) {
      finalMessage += `\n\n---\nPersonal Note from Support Team:\n${customMessage}`;
    }

    return finalMessage;
  };

  const handleSubmit = () => {
    onSubmit({
      interventionType,
      deliveryMethod,
      message: getFinalMessage(),
      customMessage: customMessage || undefined
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-6 w-6 text-primary" />
            <span>Intervention Recommendation</span>
          </DialogTitle>
          <DialogDescription>
            AI-powered responsible gambling intervention system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-red-900">Player: {playerName}</h4>
              <Badge className="bg-red-100 text-red-800">
                Risk Score: {riskScore}/100
              </Badge>
            </div>
            <p className="text-sm text-red-700">
              <strong>Trigger Reason:</strong> {triggerReason}
            </p>
          </div>

          <div>
            <Label className="text-base font-semibold mb-3 block">
              Select Intervention Type
            </Label>
            <RadioGroup value={interventionType} onValueChange={setInterventionType}>
              <div className="grid grid-cols-2 gap-3">
                {interventionTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <div
                      key={type.value}
                      className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        interventionType === type.value
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setInterventionType(type.value)}
                    >
                      <RadioGroupItem value={type.value} id={type.value} />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Icon className="h-4 w-4" />
                          <Label htmlFor={type.value} className="font-medium cursor-pointer">
                            {type.label}
                          </Label>
                        </div>
                        <p className="text-xs text-gray-600">{type.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-base font-semibold mb-3 block">
              Delivery Method
            </Label>
            <RadioGroup value={deliveryMethod} onValueChange={setDeliveryMethod}>
              <div className="grid grid-cols-2 gap-2">
                {deliveryMethods.map((method) => (
                  <div
                    key={method.value}
                    className={`flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      deliveryMethod === method.value
                        ? 'border-primary bg-primary/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setDeliveryMethod(method.value)}
                  >
                    <RadioGroupItem value={method.value} id={method.value} />
                    <Label htmlFor={method.value} className="font-medium cursor-pointer flex-1">
                      {method.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="editable-message" className="text-base font-semibold flex items-center space-x-2">
                <MessageSquare className="h-4 w-4" />
                <span>Message Content</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditableMessage(getDefaultTemplate(interventionType))}
                className="text-xs h-7"
              >
                Reset to Template
              </Button>
            </div>
            <Textarea
              id="editable-message"
              placeholder="Edit the message that will be sent to the player..."
              value={editableMessage}
              onChange={(e) => setEditableMessage(e.target.value)}
              rows={8}
              className="resize-none font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Edit the message above to personalize it for {playerName}.
            </p>
          </div>

          <div>
            <Label htmlFor="custom-message" className="text-base font-semibold mb-2 flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span>Additional Note (Optional)</span>
            </Label>
            <Textarea
              id="custom-message"
              placeholder="Add an extra personalized note from the support team..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be added at the end of the message above.
            </p>
          </div>

          {/* Message Preview */}
          <div className="border-t pt-4">
            <Label className="text-base font-semibold mb-3 flex items-center space-x-2">
              <Eye className="h-4 w-4" />
              <span>Message Preview</span>
            </Label>
            <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-primary/20">
                <span className="text-sm font-semibold text-primary">{casinoName} Support</span>
                <Badge variant="outline" className="text-xs">
                  {deliveryMethods.find(m => m.value === deliveryMethod)?.label}
                </Badge>
              </div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {getFinalMessage()}
              </div>
              <div className="mt-3 pt-3 border-t border-primary/20 flex items-center justify-between">
                <span className="text-xs text-primary">Sent with care by {casinoName}</span>
                <span className="text-xs text-gray-500">{new Date().toLocaleString()}</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2 flex items-start space-x-1">
              <span>💡</span>
              <span>This preview shows what {playerName} will receive. Messages are crafted to be supportive, non-judgmental, and action-oriented.</span>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90">
            Send Intervention
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

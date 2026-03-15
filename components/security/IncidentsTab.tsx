'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ShieldAlert, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Clock, TriangleAlert as AlertTriangle, Circle as XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEV_CONFIG, STATUS_BADGE, timeAgo } from '@/components/security/securityUtils';
import type { SecurityIncident, Casino } from '@/components/security/securityUtils';

interface Props {
  incidents: SecurityIncident[];
  casinos: Casino[];
  onUpdateIncident: (id: string, status: string, notes?: string) => void;
}

export function IncidentsTab({ incidents, casinos, onUpdateIncident }: Props) {
  const [selected, setSelected] = useState<SecurityIncident | null>(null);
  const [notes, setNotes] = useState('');

  const open = incidents.filter(i => i.status === 'open').length;
  const investigating = incidents.filter(i => i.status === 'investigating').length;
  const contained = incidents.filter(i => i.status === 'contained').length;
  const escalated = incidents.filter(i => i.escalated).length;

  const handleUpdate = (status: string) => {
    if (!selected) return;
    onUpdateIncident(selected.id, status, notes || undefined);
    setSelected(null);
    setNotes('');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Open', value: open, color: 'text-red-400', border: 'border-red-900/50', bg: 'bg-red-900/10' },
          { label: 'Investigating', value: investigating, color: 'text-amber-400', border: 'border-amber-900/50', bg: 'bg-amber-900/10' },
          { label: 'Contained', value: contained, color: 'text-blue-400', border: 'border-blue-900/50', bg: 'bg-blue-900/10' },
          { label: 'Escalated', value: escalated, color: 'text-orange-400', border: 'border-orange-900/50', bg: 'bg-orange-900/10' },
        ].map(card => (
          <div key={card.label} className={cn('bg-slate-900 border rounded-xl p-4 text-center', card.border, card.bg)}>
            <div className={cn('text-3xl font-bold', card.color)}>{card.value}</div>
            <div className="text-xs text-slate-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400 uppercase tracking-wide">Security Incidents</div>
          <div className="text-xs text-slate-600">{incidents.length} total</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                {['Ref #', 'Title', 'Severity', 'Category', 'Status', 'Escalated', 'Detected', 'Action'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.map(inc => {
                const sev = SEV_CONFIG[inc.severity] ?? SEV_CONFIG.low;
                return (
                  <tr key={inc.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                    onClick={() => { setSelected(inc); setNotes(inc.internal_notes ?? ''); }}>
                    <td className="px-4 py-2.5">
                      <code className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                        {inc.incident_number ?? inc.id.slice(0, 8).toUpperCase()}
                      </code>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-200 text-xs max-w-[220px] truncate">{inc.title}</div>
                      {inc.regulatory_notification_required && (
                        <Badge className="mt-0.5 bg-red-900/60 text-red-300 border-red-700 text-xs">POPIA Required</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={cn('text-xs capitalize', sev.badge)}>{inc.severity}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 capitalize whitespace-nowrap">
                      {inc.category?.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={cn('text-xs capitalize whitespace-nowrap', STATUS_BADGE[inc.status] ?? STATUS_BADGE.open)}>
                        {inc.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {inc.escalated
                        ? <AlertTriangle className="h-4 w-4 text-orange-400 mx-auto" />
                        : <XCircle className="h-4 w-4 text-slate-700 mx-auto" />}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {inc.detected_at ? timeAgo(inc.detected_at) : timeAgo(inc.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20 px-2 whitespace-nowrap">
                        Respond
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-600 text-sm">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-700" />
                    No incidents recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-slate-100 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-100">
                <ShieldAlert className="h-5 w-5 text-red-400" />
                Incident Response — {selected.incident_number ?? selected.id.slice(0, 8).toUpperCase()}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-sm">{selected.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1.5">Severity</div>
                  <Badge variant="outline" className={cn('capitalize', SEV_CONFIG[selected.severity]?.badge)}>
                    {selected.severity}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1.5">Status</div>
                  <Badge variant="outline" className={cn('capitalize', STATUS_BADGE[selected.status] ?? '')}>
                    {selected.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1.5">Category</div>
                  <span className="text-slate-300 capitalize text-xs">
                    {selected.category?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {selected.description && (
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1.5">Description</div>
                  <div className="text-slate-300 bg-slate-800/60 rounded-lg p-3 text-sm leading-relaxed">
                    {selected.description}
                  </div>
                </div>
              )}

              {selected.impact_assessment && (
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1.5">Impact Assessment</div>
                  <div className="text-slate-300 bg-slate-800/40 rounded-lg p-3 text-sm leading-relaxed border border-amber-900/30">
                    {selected.impact_assessment}
                  </div>
                </div>
              )}

              {selected.affected_systems && selected.affected_systems.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1.5">Affected Systems</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.affected_systems.map(s => (
                      <code key={s} className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700">{s}</code>
                    ))}
                  </div>
                </div>
              )}

              {selected.escalated && (
                <div className="bg-red-900/25 border border-red-700/60 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-red-300 uppercase">Escalated</div>
                    {selected.escalation_reason && <div className="text-xs text-red-200/70 mt-1">{selected.escalation_reason}</div>}
                    {selected.regulatory_notification_required && (
                      <div className="text-xs text-amber-300 mt-1 font-medium">
                        POPIA / GDPR breach notification required within 72 hours.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-slate-500 uppercase mb-1.5">Investigation Notes</div>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Add containment actions, investigation findings, or resolution notes..."
                  className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 text-sm resize-none h-24" />
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                {selected.status === 'open' && (
                  <Button size="sm" variant="outline" onClick={() => handleUpdate('investigating')}
                    className="border-amber-700 text-amber-300 hover:bg-amber-900/30 text-xs">
                    <Clock className="h-3.5 w-3.5 mr-1" /> Start Investigation
                  </Button>
                )}
                {['open', 'investigating'].includes(selected.status) && (
                  <Button size="sm" variant="outline" onClick={() => handleUpdate('contained')}
                    className="border-blue-700 text-blue-300 hover:bg-blue-900/30 text-xs">
                    Mark Contained
                  </Button>
                )}
                {!['closed', 'false_positive'].includes(selected.status) && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleUpdate('closed')}
                      className="border-emerald-700 text-emerald-300 hover:bg-emerald-900/30 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Close Incident
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleUpdate('false_positive')}
                      className="border-slate-600 text-slate-400 hover:bg-slate-800 text-xs">
                      False Positive
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

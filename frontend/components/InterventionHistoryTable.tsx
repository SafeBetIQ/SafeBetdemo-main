'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { History, Download, CheckCircle, XCircle, Clock, FileText, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatPercentage } from '@/lib/utils';

interface InterventionRecord {
  id: string;
  playerId: string;
  timestamp: string;
  type: 'email' | 'sms' | 'whatsapp' | 'phone' | 'in_person';
  reason: string;
  riskScore: number;
  status: 'completed' | 'pending' | 'failed' | 'acknowledged';
  outcome: string;
  staffMember: string;
}

interface InterventionHistoryTableProps {
  interventions: InterventionRecord[];
  onExport?: () => void;
}

export function InterventionHistoryTable({
  interventions,
  onExport,
}: InterventionHistoryTableProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <FileText className="h-4 w-4 text-slate-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-primary/10 text-primary',
      failed: 'bg-red-100 text-red-700',
      pending: 'bg-yellow-100 text-yellow-700',
      acknowledged: 'bg-slate-100 text-slate-700',
    };
    return styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-700';
  };

  const getTypeColor = (type: string) => {
    const colors = {
      email: 'bg-slate-100 text-slate-700',
      sms: 'bg-purple-100 text-purple-700',
      whatsapp: 'bg-primary/10 text-primary',
      phone: 'bg-orange-100 text-orange-700',
      in_person: 'bg-slate-100 text-slate-700',
    };
    return colors[type as keyof typeof colors] || 'bg-slate-100 text-slate-700';
  };

  const successRate = interventions.length > 0
    ? (interventions.filter(i => i.status === 'completed').length / interventions.length) * 100
    : 0;

  return (
    <Card className="border-slate-200 relative">
      <div className="absolute top-3 right-3 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>Complete audit trail of all responsible gambling interventions sent to players, including delivery status, player responses, and effectiveness metrics for regulatory compliance.</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="h-5 w-5 text-slate-600" />
            <CardTitle className="text-lg">Intervention History</CardTitle>
          </div>
          {onExport && (
            <Button
              size="sm"
              variant="outline"
              onClick={onExport}
              className="text-slate-700 border-slate-300"
            >
              <Download className="h-3 w-3 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
        <CardDescription className="text-xs">
          Compliance audit trail - {interventions.length} interventions recorded
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-xs text-primary mb-1">Success Rate</p>
            <p className="text-2xl font-bold text-primary">{formatPercentage(successRate)}</p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-xs text-slate-700 mb-1">Total Actions</p>
            <p className="text-2xl font-bold text-slate-900">{interventions.length}</p>
          </div>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-700 mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-900">
              {interventions.filter(i => i.status === 'pending').length}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs">Player ID</TableHead>
                <TableHead className="text-xs">Date & Time</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Risk</TableHead>
                <TableHead className="text-xs">Reason</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Staff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interventions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    No interventions recorded
                  </TableCell>
                </TableRow>
              ) : (
                interventions.map((intervention) => (
                  <TableRow key={intervention.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-xs text-slate-700">
                      {intervention.playerId}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {new Date(intervention.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getTypeColor(intervention.type)} border-0 text-xs capitalize`}>
                        {intervention.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${
                          intervention.riskScore >= 80 ? 'bg-red-100 text-red-700' :
                          intervention.riskScore >= 60 ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        } border-0 text-xs`}
                      >
                        {intervention.riskScore}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 max-w-xs truncate">
                      {intervention.reason}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(intervention.status)}
                        <Badge className={`${getStatusBadge(intervention.status)} border-0 text-xs capitalize`}>
                          {intervention.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {intervention.staffMember}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs font-medium text-slate-700 mb-2">Compliance Notes:</p>
          <ul className="space-y-1 text-xs text-slate-600">
            <li>• All interventions are logged for regulatory audit purposes</li>
            <li>• Staff members are identified for accountability and training assessment</li>
            <li>• Success rate calculated from completed vs total interventions</li>
            <li>• Player identities are anonymized in exported reports</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

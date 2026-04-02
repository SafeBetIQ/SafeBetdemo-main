'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Search, Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface SendNovaIQInvitationProps {
  casinoId?: string;
  onSuccess?: () => void;
}

export function SendNovaIQInvitation({ casinoId, onSuccess }: SendNovaIQInvitationProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [gameConcepts, setGameConcepts] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedGameConceptId, setSelectedGameConceptId] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [searchTerm, setSearchTerm] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, casinoId]);

  async function loadData() {
    setLoading(true);

    const conceptsQuery = supabase
      .from('wellbeing_game_concepts')
      .select('*')
      .eq('active', true)
      .order('name');

    const playersQuery = casinoId
      ? supabase
          .from('players')
          .select('id, first_name, last_name, email, phone, casino_id, casinos(name)')
          .eq('casino_id', casinoId)
          .order('first_name')
      : supabase
          .from('players')
          .select('id, first_name, last_name, email, phone, casino_id, casinos(name)')
          .order('first_name')
          .limit(200);

    const [conceptsRes, playersRes] = await Promise.all([conceptsQuery, playersQuery]);

    setGameConcepts(conceptsRes.data || []);
    setPlayers(playersRes.data || []);
    setLoading(false);
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayers(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  }

  function toggleAllPlayers() {
    const filtered = filteredPlayers;
    if (selectedPlayers.length === filtered.length) {
      setSelectedPlayers([]);
    } else {
      setSelectedPlayers(filtered.map(p => p.id));
    }
  }

  async function sendInvitations() {
    if (!selectedGameConceptId) {
      toast.error('Please select a game');
      return;
    }

    if (selectedPlayers.length === 0) {
      toast.error('Please select at least one player');
      return;
    }

    setSending(true);
    setSendResults([]);

    const results = [];

    for (const playerId of selectedPlayers) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-wellbeing-invitation`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              player_id: playerId,
              game_concept_id: selectedGameConceptId,
              channel: selectedChannel,
              expires_in_hours: 72,
            }),
          }
        );

        const result = await response.json();

        if (response.ok) {
          results.push({
            playerId,
            success: true,
            message: result.message,
            deliveryStatus: result.delivery_status,
          });
        } else {
          results.push({
            playerId,
            success: false,
            error: result.error || 'Failed to send',
          });
        }
      } catch (error) {
        results.push({
          playerId,
          success: false,
          error: 'Network error',
        });
      }
    }

    setSendResults(results);
    setSending(false);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    if (successCount > 0) {
      toast.success(`Successfully sent ${successCount} invitation${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to send ${failCount} invitation${failCount > 1 ? 's' : ''}`);
    }

    if (successCount > 0 && onSuccess) {
      onSuccess();
    }

    setTimeout(() => {
      if (failCount === 0) {
        setOpen(false);
        setSelectedPlayers([]);
        setSelectedGameConceptId('');
        setSendResults([]);
      }
    }, 2000);
  }

  const filteredPlayers = players.filter(player => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      player.first_name?.toLowerCase().includes(search) ||
      player.last_name?.toLowerCase().includes(search) ||
      player.email?.toLowerCase().includes(search) ||
      player.phone?.toLowerCase().includes(search)
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          <Send className="w-4 h-4 mr-2" />
          Send Invitations
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Send Nova IQ Invitations</DialogTitle>
          <DialogDescription>
            Select players and a game to send wellbeing check-in invitations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Game</Label>
              <Select value={selectedGameConceptId} onValueChange={setSelectedGameConceptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a game..." />
                </SelectTrigger>
                <SelectContent>
                  {gameConcepts.map(game => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.name} ({game.duration_minutes} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Delivery Channel</Label>
              <Select value={selectedChannel} onValueChange={(val: any) => setSelectedChannel(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      WhatsApp
                    </div>
                  </SelectItem>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between">
              <Label>Select Players ({selectedPlayers.length} selected)</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAllPlayers}
                disabled={loading || sending}
              >
                {selectedPlayers.length === filteredPlayers.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={loading || sending}
              />
            </div>

            <ScrollArea className="flex-1 border rounded-md p-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPlayers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No players found
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPlayers.map(player => {
                    const isSelected = selectedPlayers.includes(player.id);
                    const result = sendResults.find(r => r.playerId === player.id);

                    return (
                      <div
                        key={player.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          isSelected ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                        } ${result ? (result.success ? 'bg-green-500/5 border-green-500' : 'bg-red-500/5 border-red-500') : ''}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => togglePlayer(player.id)}
                          disabled={sending || !!result}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {player.first_name} {player.last_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground">{player.email}</p>
                            {player.phone && (
                              <>
                                <span className="text-xs text-muted-foreground">•</span>
                                <p className="text-xs text-muted-foreground">{player.phone}</p>
                              </>
                            )}
                          </div>
                          {!casinoId && player.casinos?.name && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {player.casinos.name}
                            </Badge>
                          )}
                        </div>
                        {result && (
                          <div>
                            {result.success ? (
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {selectedPlayers.length} player{selectedPlayers.length !== 1 ? 's' : ''} selected
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                onClick={sendInvitations}
                disabled={sending || selectedPlayers.length === 0 || !selectedGameConceptId}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send {selectedPlayers.length} Invitation{selectedPlayers.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

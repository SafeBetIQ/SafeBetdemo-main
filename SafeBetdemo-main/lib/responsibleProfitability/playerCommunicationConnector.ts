// ─── SafeBet IQ — B13.1 Player Communication Connector (SANDBOX ONLY) ───
//
// Transport seam. B13.1 ships ONLY a sandbox connector: it performs NO network I/O,
// reads NO player contact detail, holds NO secret, and sends NO real message. It returns a
// deterministic receipt derived solely from the PII-free transport token. Real delivery
// (B13.2) would add a separate connector behind owner policy; this interface exists so that
// the orchestration never embeds a live provider.

import { sandboxTransportToken, sandboxProviderReference } from './playerCommunications.ts';

export interface SendRequest {
  casinoId: string;
  communicationId: string;
  sendIdempotencyKey: string;
  deliveryMode: string;      // MUST be 'SANDBOX' in B13.1
  communicationType: string;
  templateKey: string;
  templateVersion: number;
}
export interface SendReceipt {
  sandbox: boolean;
  status: 'SUBMITTED' | 'FAILED';
  providerReference: string | null;
  failureClass: string | null;
}
export interface PlayerCommunicationConnector {
  readonly mode: string;
  send(req: SendRequest): Promise<SendReceipt>;
}

/** The only connector in B13.1. Fail-closed on any non-SANDBOX request. No I/O, no contact, no secret. */
export class SandboxPlayerCommunicationConnector implements PlayerCommunicationConnector {
  readonly mode = 'SANDBOX';
  async send(req: SendRequest): Promise<SendReceipt> {
    if (req.deliveryMode !== 'SANDBOX') {
      // Hard runtime guard (3rd layer, after DB CHECK + begin-send RPC assertion).
      throw new Error('B13 sandbox connector refuses non-SANDBOX delivery');
    }
    const token = sandboxTransportToken(req.casinoId, req.communicationId, req.sendIdempotencyKey);
    return { sandbox: true, status: 'SUBMITTED', providerReference: sandboxProviderReference(token), failureClass: null };
  }
}

/**
 * Resolve the active connector. B13.1 is sandbox only: any non-SANDBOX environment request
 * fails closed (no real-send capability can be enabled by configuration in B13.1).
 */
export function resolvePlayerCommunicationConnector(): PlayerCommunicationConnector {
  const mode = (process.env.RP_PLAYER_COMMUNICATION_MODE ?? 'SANDBOX').toUpperCase();
  if (mode !== 'SANDBOX') {
    throw new Error('B13.1 supports SANDBOX delivery only; real delivery is not enabled');
  }
  return new SandboxPlayerCommunicationConnector();
}

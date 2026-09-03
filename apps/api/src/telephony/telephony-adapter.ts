export type TelephonyEventType =
  | "INCOMING_CALL"
  | "OUTGOING_CALL"
  | "RINGING"
  | "ANSWERED"
  | "HELD"
  | "RESUMED"
  | "ENDED"
  | "FAILED";

export type TelephonyEvent = {
  type: TelephonyEventType;
  providerCallId: string;
  occurredAt: Date;
};

export interface TelephonyAdapter {
  initialize(): Promise<void>;
  register(): Promise<void>;
  unregister(): Promise<void>;
  dial(remoteNumber: string): Promise<TelephonyEvent>;
  answer(providerCallId: string): Promise<TelephonyEvent>;
  hangup(providerCallId: string): Promise<TelephonyEvent>;
  hold(providerCallId: string): Promise<TelephonyEvent>;
  resume(providerCallId: string): Promise<TelephonyEvent>;
  mute(providerCallId: string): Promise<TelephonyEvent>;
  unmute(providerCallId: string): Promise<TelephonyEvent>;
  sendDtmf(providerCallId: string, digit: string): Promise<TelephonyEvent>;
  transfer(providerCallId: string, target: string): Promise<TelephonyEvent>;
}

export class MockTelephonyAdapter implements TelephonyAdapter {
  async initialize() {}
  async register() {}
  async unregister() {}
  async dial(_remoteNumber: string) { return this.event("OUTGOING_CALL"); }
  async answer(providerCallId: string) { return this.event("ANSWERED", providerCallId); }
  async hangup(providerCallId: string) { return this.event("ENDED", providerCallId); }
  async hold(providerCallId: string) { return this.event("HELD", providerCallId); }
  async resume(providerCallId: string) { return this.event("RESUMED", providerCallId); }
  async mute(providerCallId: string) { return this.event("ANSWERED", providerCallId); }
  async unmute(providerCallId: string) { return this.event("ANSWERED", providerCallId); }
  async sendDtmf(providerCallId: string, _digit: string) { return this.event("ANSWERED", providerCallId); }
  async transfer(providerCallId: string, _target: string) { return this.event("ANSWERED", providerCallId); }

  private event(type: TelephonyEventType, providerCallId = `mock-${crypto.randomUUID()}`): TelephonyEvent {
    return { type, providerCallId, occurredAt: new Date() };
  }
}

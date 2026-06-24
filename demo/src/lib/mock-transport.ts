import type { ChatTransport, UIMessage } from 'ai';

/**
 * A no-op transport: screenshots are driven entirely by `initialMessages`, so a
 * turn is never actually sent. `sendMessages` returns an immediately-closed
 * stream and `reconnectToStream` resolves to null — enough to satisfy the
 * `ChatTransport` contract without any network.
 */
export const mockTransport: ChatTransport<UIMessage> = {
  async sendMessages() {
    return new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
  },
  async reconnectToStream() {
    return null;
  },
};

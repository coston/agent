// @vitest-environment jsdom
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// Inline stand-ins for @coston/ui so dropdown items / dialogs render without
// Radix portals — keeps the test focused on orchestration logic.
vi.mock('@coston/ui/button', () => ({
  Button: ({ children, ...p }: ComponentProps<'button'>) => <button {...p}>{children}</button>,
}));
vi.mock('@coston/ui/input', () => ({
  Input: (p: ComponentProps<'input'>) => <input {...p} />,
}));
vi.mock('@coston/ui/dropdown-menu', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: Pass,
    DropdownMenuLabel: Pass,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuItem: ({ children, onSelect, ...p }: { children?: ReactNode; onSelect?: () => void } & Record<string, unknown>) => (
      <button onClick={onSelect} {...p}>
        {children}
      </button>
    ),
  };
});
vi.mock('@coston/ui/dialog', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
    DialogContent: Pass,
    DialogDescription: Pass,
    DialogFooter: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
  };
});
vi.mock('@coston/ui/alert-dialog', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    AlertDialog: ({ children, open }: { children?: ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
    AlertDialogContent: Pass,
    AlertDialogDescription: Pass,
    AlertDialogFooter: Pass,
    AlertDialogHeader: Pass,
    AlertDialogTitle: Pass,
    AlertDialogCancel: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
    AlertDialogAction: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
  };
});

const { ChatPanel } = await import('./chat-panel');

function makeSessions() {
  return {
    create: vi.fn(async () => ({ id: 'c-new', title: 'Chat 2' })),
    rename: vi.fn(async (id: string, title: string) => ({ id, title })),
    remove: vi.fn(async () => {}),
    loadMessages: vi.fn(async () => [{ id: 'm', role: 'user', parts: [] }]),
  };
}

function renderPanel(overrides: Partial<Parameters<typeof ChatPanel>[0]> = {}) {
  const sessions = overrides.sessions ?? makeSessions();
  const renderSession = vi.fn((args: { conversationId: string }) => (
    <div data-testid="active-session">{args.conversationId}</div>
  ));
  render(
    <ChatPanel
      partitionId="p1"
      conversations={[
        { id: 'c1', title: 'Chat 1' },
        { id: 'c2', title: 'Chat 2' },
      ]}
      activeConversationId="c1"
      initialMessages={[]}
      sessions={sessions}
      providerReady
      renderSession={renderSession}
      {...overrides}
    />
  );
  return { sessions, renderSession };
}

describe('ChatPanel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('renders the active session via the render prop', () => {
    renderPanel();
    expect(screen.getByTestId('active-session').textContent).toBe('c1');
  });

  it('switches sessions and loads messages for an uncached one', async () => {
    const { sessions } = renderPanel();
    const items = screen.getAllByTestId('session-item');
    // Second item is c2 (uncached) — selecting it loads its messages.
    fireEvent.click(items[1]!);
    await waitFor(() => expect(sessions.loadMessages).toHaveBeenCalledWith('c2'));
    expect(screen.getByTestId('active-session').textContent).toBe('c2');
  });

  it('creates a new chat via the controller', async () => {
    const { sessions } = renderPanel();
    fireEvent.click(screen.getByTestId('session-new'));
    await waitFor(() => expect(sessions.create).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('active-session').textContent).toBe('c-new'));
  });

  it('deletes the active chat and falls back to a remaining one', async () => {
    const { sessions } = renderPanel();
    fireEvent.click(screen.getByTestId('session-delete')); // open confirm
    fireEvent.click(screen.getByText('Delete')); // confirm
    await waitFor(() => expect(sessions.remove).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(screen.getByTestId('active-session').textContent).toBe('c2'));
  });

  it('renames the active chat through the controller', async () => {
    const { sessions } = renderPanel();
    fireEvent.click(screen.getByTestId('session-rename')); // open dialog
    const input = screen.getByTestId('session-rename-input');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(sessions.rename).toHaveBeenCalledWith('c1', 'Renamed'));
  });

  it('opens the config panel by default when no provider is ready', () => {
    renderPanel({
      providerReady: false,
      renderConfig: () => <div data-testid="config">config</div>,
    });
    expect(screen.getByTestId('config')).toBeTruthy();
  });
});

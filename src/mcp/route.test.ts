import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock mcp-handler so we can assert the wiring without a real transport.
const { createMcpHandlerMock, withMcpAuthMock } = vi.hoisted(() => ({
  createMcpHandlerMock: vi.fn((..._args: unknown[]) => 'inner-handler'),
  withMcpAuthMock: vi.fn((..._args: unknown[]) => 'auth-handler'),
}));

vi.mock('mcp-handler', () => ({
  createMcpHandler: createMcpHandlerMock,
  withMcpAuth: withMcpAuthMock,
}));

const { createMcpRoute } = await import('./route');

describe('createMcpRoute', () => {
  beforeEach(() => {
    createMcpHandlerMock.mockClear();
    withMcpAuthMock.mockClear();
  });

  const baseOptions = () => ({
    serverInfo: { name: 'example', version: '1.0.0' },
    registerTools: vi.fn(),
    verifyToken: vi.fn(async () => undefined),
  });

  it('wires serverInfo, registerTools, and Streamable-HTTP defaults', () => {
    const opts = baseOptions();
    createMcpRoute(opts);

    expect(createMcpHandlerMock).toHaveBeenCalledTimes(1);
    const [register, info, config] = createMcpHandlerMock.mock.calls[0]!;
    // registerTools is invoked with the server instance.
    (register as (s: unknown) => void)({ server: true });
    expect(opts.registerTools).toHaveBeenCalledWith({ server: true });
    expect(info).toEqual({ serverInfo: { name: 'example', version: '1.0.0' } });
    expect(config).toMatchObject({ basePath: '/api', disableSse: true });
  });

  it('requires auth and forwards the injected verifier by default', () => {
    const opts = baseOptions();
    createMcpRoute(opts);
    const [inner, verify, authConfig] = withMcpAuthMock.mock.calls[0]!;
    expect(inner).toBe('inner-handler');
    expect(verify).toBe(opts.verifyToken);
    expect(authConfig).toMatchObject({ required: true });
    expect(authConfig).not.toHaveProperty('resourceMetadataPath');
  });

  it('advertises OAuth protected-resource metadata when configured', () => {
    createMcpRoute({
      ...baseOptions(),
      oauth: { resourceMetadataPath: '/.well-known/oauth-protected-resource' },
    });
    const authConfig = withMcpAuthMock.mock.calls[0]![2];
    expect(authConfig).toMatchObject({
      required: true,
      resourceMetadataPath: '/.well-known/oauth-protected-resource',
    });
  });

  it('exposes the same auth handler as GET, POST, and DELETE', () => {
    const route = createMcpRoute(baseOptions());
    expect(route.GET).toBe('auth-handler');
    expect(route.GET).toBe(route.POST);
    expect(route.POST).toBe(route.DELETE);
  });

  it('honours basePath, disableSse, and required overrides', () => {
    createMcpRoute({ ...baseOptions(), basePath: '/mcp', disableSse: false, required: false });
    const config = createMcpHandlerMock.mock.calls[0]![2];
    expect(config).toMatchObject({ basePath: '/mcp', disableSse: false });
    expect(withMcpAuthMock.mock.calls[0]![2]).toMatchObject({ required: false });
  });
});

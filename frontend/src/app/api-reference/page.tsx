'use client';

import React, { useState } from 'react';
import {
    Terminal,
    Play,
    Code2,
    Lock,
    Server,
    Send,
    Loader2,
    Copy,
    CheckCircle2
} from 'lucide-react';

type HttpMethod = 'GET' | 'POST' | 'PATCH';

interface ApiParam {
    name: string;
    type: string;
    required: boolean;
    description: string;
    in: 'path' | 'query' | 'body';
    default?: string;
}

interface Endpoint {
    id: string;
    method: HttpMethod;
    path: string;
    title: string;
    description: string;
    requiresAuth: boolean;
    params: ApiParam[];
}

const ENDPOINTS: Endpoint[] = [
    {
        id: 'get-stats',
        method: 'GET',
        path: '/api/stats',
        title: 'Global Statistics',
        description: 'Retrieve platform-wide launch and trading volume statistics.',
        requiresAuth: false,
        params: []
    },
    {
        id: 'get-launches',
        method: 'GET',
        path: '/api/launches',
        title: 'List Launches',
        description: 'Retrieve a paginated list of token launches.',
        requiresAuth: false,
        params: [
            { name: 'limit', type: 'number', required: false, description: 'Number of items to return (default: 50)', in: 'query', default: '10' },
            { name: 'offset', type: 'number', required: false, description: 'Pagination offset', in: 'query', default: '0' }
        ]
    },
    {
        id: 'get-launch-detail',
        method: 'GET',
        path: '/api/launches/:address',
        title: 'Launch Details',
        description: 'Get detailed information and metadata for a specific token launch.',
        requiresAuth: false,
        params: [
            { name: 'address', type: 'string', required: true, description: 'The EVM token address', in: 'path', default: '0x0000000000000000000000000000000000000000' }
        ]
    },
    {
        id: 'patch-launch-metadata',
        method: 'PATCH',
        path: '/api/launches/:address/metadata',
        title: 'Update Metadata',
        description: 'Update the social links and description of a token launch. Requires Bitcoin wallet signature from the original creator.',
        requiresAuth: true,
        params: [
            { name: 'address', type: 'string', required: true, description: 'The EVM token address', in: 'path', default: '0x0000000000000000000000000000000000000000' },
            { name: 'description', type: 'string', required: false, description: 'Token description', in: 'body' },
            { name: 'twitterUrl', type: 'string', required: false, description: 'Twitter/X URL', in: 'body' },
            { name: 'telegramUrl', type: 'string', required: false, description: 'Telegram URL', in: 'body' },
            { name: 'websiteUrl', type: 'string', required: false, description: 'Website URL', in: 'body' }
        ]
    },
    {
        id: 'get-user-holdings',
        method: 'GET',
        path: '/api/user/:address/holdings',
        title: 'User Portfolio',
        description: 'Retrieve the current token holdings and unrealized PnL for a user.',
        requiresAuth: false,
        params: [
            { name: 'address', type: 'string', required: true, description: 'The user\'s Bitcoin address', in: 'path', default: 'bc1q...' }
        ]
    },
    {
        id: 'get-activity',
        method: 'GET',
        path: '/api/activity',
        title: 'Global Activity Feed',
        description: 'Get the latest trades, token creations, and NFT mints across the platform.',
        requiresAuth: false,
        params: []
    }
];

const METHOD_COLORS: Record<HttpMethod, string> = {
    GET: 'var(--blue-500)',
    POST: 'var(--green-500)',
    PATCH: 'var(--orange-500)'
};

const METHOD_BG_COLORS: Record<HttpMethod, string> = {
    GET: 'rgba(59, 130, 246, 0.1)',
    POST: 'rgba(34, 197, 94, 0.1)',
    PATCH: 'rgba(249, 115, 22, 0.1)'
};

type ApiResponse = {
    _status?: number;
    _error?: boolean;
    message?: string;
    _simulated?: boolean;
    [key: string]: unknown;
};

export default function ApiReferencePage() {
    const [activeEndpointId, setActiveEndpointId] = useState<string>(ENDPOINTS[0].id);
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [authWallet, setAuthWallet] = useState<string>('');
    const [authSignature, setAuthSignature] = useState<string>('');
    const [response, setResponse] = useState<ApiResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSimulatorMode, setIsSimulatorMode] = useState(false);
    const [copied, setCopied] = useState(false);

    const activeEndpoint = ENDPOINTS.find(e => e.id === activeEndpointId)!;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.midllaunch.fun';

    // Initialize defaults on endpoint change
    React.useEffect(() => {
        const initial: Record<string, string> = {};
        activeEndpoint.params.forEach(p => {
            if (p.default) initial[p.name] = p.default;
        });
        setParamValues(initial);
        setResponse(null);
    }, [activeEndpointId, activeEndpoint]);

    const handleParamChange = (name: string, value: string) => {
        setParamValues(prev => ({ ...prev, [name]: value }));
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(generateCurl());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const generateUrl = () => {
        let url = activeEndpoint.path;

        // Replace path params
        activeEndpoint.params.filter(p => p.in === 'path').forEach(p => {
            const val = paramValues[p.name] || `:${p.name}`;
            url = url.replace(`:${p.name}`, encodeURIComponent(val));
        });

        // Add query params
        const queryParams = activeEndpoint.params.filter(p => p.in === 'query');
        const queryString = queryParams
            .filter(p => paramValues[p.name])
            .map(p => `${encodeURIComponent(p.name)}=${encodeURIComponent(paramValues[p.name])}`)
            .join('&');

        return `${baseUrl}${url}${queryString ? `?${queryString}` : ''}`;
    };

    const generateBody = () => {
        const bodyParams = activeEndpoint.params.filter(p => p.in === 'body');
        if (bodyParams.length === 0 && !activeEndpoint.requiresAuth) return undefined;

        const body: Record<string, unknown> = {};
        bodyParams.forEach(p => {
            if (paramValues[p.name]) {
                body[p.name] = paramValues[p.name];
            }
        });

        if (activeEndpoint.requiresAuth) {
            body.auth = {
                address: authWallet || 'YOUR_WALLET_ADDRESS',
                message: 'MidlLaunch API Auth',
                signature: authSignature || 'PASTE_SIGNATURE_HERE'
            };
        }

        return Object.keys(body).length > 0 ? JSON.stringify(body, null, 2) : undefined;
    };

    const generateCurl = () => {
        const url = generateUrl();
        const body = generateBody();

        let curl = `curl -X ${activeEndpoint.method} "${url}"`;
        if (body) {
            curl += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;
        }
        return curl;
    };

    const handleSend = async () => {
        setIsLoading(true);
        setResponse(null);

        if (isSimulatorMode) {
            // Fake a delay and return mock data
            setTimeout(() => {
                setResponse({
                    _simulated: true,
                    status: 200,
                    message: "Simulator mode active. Real request bypassed.",
                    url: generateUrl(),
                    method: activeEndpoint.method
                });
                setIsLoading(false);
            }, 600);
            return;
        }

        try {
            const url = generateUrl();
            const body = generateBody();

            const res = await fetch(url, {
                method: activeEndpoint.method,
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body
            });

            const contentType = res.headers.get("content-type");
            let data;
            if (contentType && contentType.indexOf("application/json") !== -1) {
                data = await res.json();
            } else {
                data = await res.text();
            }

            setResponse({
                _status: res.status,
                ...data
            });
        } catch (err) {
            setResponse({
                _error: true,
                message: err instanceof Error ? err.message : 'Network error occurred'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container md:mx-auto md:px-4 py-8 max-w-7xl flex flex-col md:flex-row gap-6 min-h-[calc(100vh-200px)]">

            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-4">
                <div
                    className="rounded-xl p-4 sticky top-24"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
                >
                    <div className="flex items-center gap-2 mb-6">
                        <Terminal size={18} style={{ color: 'var(--orange-500)' }} />
                        <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>API Reference</h2>
                    </div>

                    <div className="text-xs font-semibold uppercase tracking-wider mb-2 mt-4 px-2" style={{ color: 'var(--text-tertiary)' }}>
                        Endpoints
                    </div>
                    <nav className="flex flex-col gap-1">
                        {ENDPOINTS.map(endpoint => {
                            const isActive = activeEndpointId === endpoint.id;
                            return (
                                <button
                                    key={endpoint.id}
                                    onClick={() => setActiveEndpointId(endpoint.id)}
                                    className="flex flex-col items-start px-3 py-2 rounded-lg transition-all text-left"
                                    style={{
                                        background: isActive ? 'var(--bg-elevated)' : 'transparent',
                                        border: isActive ? '1px solid var(--bg-border)' : '1px solid transparent',
                                    }}
                                >
                                    <div className="flex items-center gap-2 w-full">
                                        <span
                                            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                                            style={{
                                                color: METHOD_COLORS[endpoint.method],
                                                background: METHOD_BG_COLORS[endpoint.method]
                                            }}
                                        >
                                            {endpoint.method}
                                        </span>
                                        <span
                                            className="text-xs font-medium truncate"
                                            style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                                        >
                                            {endpoint.title}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </nav>

                    <div className="mt-8 border-t pt-4" style={{ borderColor: 'var(--bg-border)' }}>
                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                            <input
                                type="checkbox"
                                checked={isSimulatorMode}
                                onChange={(e) => setIsSimulatorMode(e.target.checked)}
                                className="rounded border-gray-600 bg-transparent text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                            />
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                Simulator Mode
                            </span>
                        </label>
                        <p className="text-xs px-2 mt-1" style={{ color: 'var(--text-tertiary)' }}>
                            Enable to mock requests without hitting the live DB.
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Console Area */}
            <div className="flex-1 flex flex-col gap-6">

                {/* Header Setup */}
                <div
                    className="rounded-xl overflow-hidden p-6 relative"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
                >
                    {/* Subtle bg glow */}
                    <div
                        className="absolute top-0 right-0 w-64 h-64 opacity-5 pointer-events-none rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"
                        style={{ background: 'var(--brand-main)' }}
                    />

                    <div className="relative z-10 flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span
                                    className="text-xs font-mono font-bold px-2 py-1 rounded"
                                    style={{
                                        color: METHOD_COLORS[activeEndpoint.method],
                                        background: METHOD_BG_COLORS[activeEndpoint.method],
                                        border: `1px solid ${METHOD_COLORS[activeEndpoint.method]}30`
                                    }}
                                >
                                    {activeEndpoint.method}
                                </span>
                                <span className="font-mono text-sm tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                                    {activeEndpoint.path}
                                </span>
                            </div>
                            <h1 className="font-display font-bold text-2xl mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>
                                {activeEndpoint.title}
                            </h1>
                            <p className="text-sm max-w-2xl" style={{ color: 'var(--text-tertiary)' }}>
                                {activeEndpoint.description}
                            </p>
                        </div>

                        {activeEndpoint.requiresAuth && (
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--orange-500)', border: '1px solid rgba(249,115,22,0.3)' }}>
                                <Lock size={12} />
                                Needs BTC Signature
                            </div>
                        )}
                    </div>
                </div>

                {/* Console Split view */}
                <div className="flex flex-col lg:flex-row gap-6">

                    {/* Left: Inputs */}
                    <div className="flex-1 flex flex-col gap-4">

                        {/* Parameters */}
                        {activeEndpoint.params.length > 0 && (
                            <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}>
                                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                    <Server size={14} style={{ color: 'var(--text-tertiary)' }} />
                                    Parameters
                                </h3>

                                <div className="space-y-4">
                                    {activeEndpoint.params.map(p => (
                                        <div key={p.name} className="flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                                    {p.name}
                                                    {p.required && <span className="text-red-500 ml-1">*</span>}
                                                </label>
                                                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                                    {p.in} • {p.type}
                                                </span>
                                            </div>
                                            <input
                                                type={p.type === 'number' ? 'number' : 'text'}
                                                value={paramValues[p.name] || ''}
                                                onChange={(e) => handleParamChange(p.name, e.target.value)}
                                                placeholder={p.default || `Enter ${p.name}`}
                                                className="w-full bg-black/40 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-colors"
                                                style={{ borderColor: 'var(--bg-border)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--brand-main)' } as React.CSSProperties}
                                            />
                                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{p.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Auth Fields */}
                        {activeEndpoint.requiresAuth && (
                            <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--orange-500)' }}>
                                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--orange-500)' }}>
                                    <Lock size={14} />
                                    Signature Payload
                                </h3>

                                <div className="space-y-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>auth.address *</label>
                                        <input
                                            type="text"
                                            value={authWallet}
                                            onChange={(e) => setAuthWallet(e.target.value)}
                                            placeholder="bc1q..."
                                            className="w-full bg-black/40 border rounded-lg px-3 py-2 text-sm outline-none"
                                            style={{ borderColor: 'var(--bg-border)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>auth.signature *</label>
                                        <input
                                            type="text"
                                            value={authSignature}
                                            onChange={(e) => setAuthSignature(e.target.value)}
                                            placeholder="Base64 Signature String"
                                            className="w-full bg-black/40 border rounded-lg px-3 py-2 text-sm outline-none"
                                            style={{ borderColor: 'var(--bg-border)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Send Button */}
                        <button
                            onClick={handleSend}
                            disabled={isLoading}
                            className="w-full btn btn-primary py-3.5 flex items-center justify-center gap-2 text-sm tracking-wide mt-2"
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            {isSimulatorMode ? 'Simulate Request' : 'Send Request'}
                        </button>
                    </div>

                    {/* Right: Response & Code */}
                    <div className="flex-1 flex flex-col gap-4">

                        {/* Code Snippet */}
                        <div className="rounded-xl overflow-hidden flex flex-col h-auto max-h-[300px]" style={{ background: '#0d1117', border: '1px solid var(--bg-border)' }}>
                            <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--bg-border)', background: 'rgba(255,255,255,0.03)' }}>
                                <div className="flex items-center gap-2">
                                    <Code2 size={14} style={{ color: 'var(--text-tertiary)' }} />
                                    <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>cURL</span>
                                </div>
                                <button onClick={handleCopyCode} className="text-xs flex items-center gap-1 transition-colors hover:text-white" style={{ color: 'var(--text-tertiary)' }}>
                                    {copied ? <CheckCircle2 size={12} className="text-green-500" /> : <Copy size={12} />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <div className="p-4 overflow-auto scrollbar-none flex-1">
                                <pre className="text-xs font-mono whitespace-pre-wrap word-break" style={{ color: '#c9d1d9' }}>
                                    {generateCurl()}
                                </pre>
                            </div>
                        </div>

                        {/* JSON Response */}
                        <div className="rounded-xl overflow-hidden flex flex-col flex-1 min-h-[400px]" style={{ background: '#0d1117', border: '1px solid var(--bg-border)' }}>
                            <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: 'var(--bg-border)', background: 'rgba(255,255,255,0.03)' }}>
                                <Play size={14} style={{ color: 'var(--text-tertiary)' }} />
                                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>Response</span>
                                {response && response._status && (
                                    <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: String(response._status).startsWith('2') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', color: String(response._status).startsWith('2') ? 'var(--green-500)' : '#ef4444' }}>
                                        {response._status}
                                    </span>
                                )}
                            </div>
                            <div className="p-4 overflow-auto scrollbar-none flex-1 relative">
                                {isLoading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]/50 backdrop-blur-sm z-10">
                                        <Loader2 size={24} className="animate-spin text-orange-500" />
                                    </div>
                                )}

                                {!response && !isLoading && (
                                    <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-50">
                                        <Terminal size={32} style={{ color: 'var(--text-tertiary)' }} />
                                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Click Send to see API response</p>
                                    </div>
                                )}

                                {response && (
                                    <pre className="text-[11px] leading-relaxed font-mono" style={{ color: '#7ee787' }}>
                                        {JSON.stringify(response, (key, val) => {
                                            if (key.startsWith('_')) return undefined; // Filter out internal state
                                            return val;
                                        }, 2)}
                                    </pre>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}

// This shim prevents dependencies (like @base-org/account or its dependencies)
// from invoking Agoric's SES lockdown() which freezes intrinsics and breaks Next.js.

if (typeof globalThis.lockdown === 'undefined') {
    globalThis.lockdown = function (options) {
        console.warn('Antigravity: lockdown() call intercepted and ignored.', options);
        return true;
    };
}

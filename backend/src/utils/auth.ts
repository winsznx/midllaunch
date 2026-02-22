import bitcoinMessage from 'bitcoinjs-message';

export const verifySignature = (address: string, message: string, signature: string): boolean => {
    try {
        // This handles standard Bitcoin signed messages (P2PKH, Segwit)
        return bitcoinMessage.verify(message, address, signature);
    } catch (e) {
        return false;
    }
};

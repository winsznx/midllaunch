import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main() {
  const tokenAddr = "0x8Ac6950FA120EBa9a68ab6faB1c28787A00F7Ae8".toLowerCase();
  const launch = await prisma.launch.findUnique({ where: { tokenAddress: tokenAddr } });
  if (!launch) {
    console.log("not found");
    return;
  }
  const purchases = await prisma.purchase.findMany({ where: { launchId: launch.id } });
  console.log("Purchases:", purchases.length);
  console.log(purchases.map(p => ({
    buyer: p.buyer,
    txHash: p.txHash,
    tokenAmount: p.tokenAmount,
    btcAmount: p.btcAmount,
    timestamp: p.timestamp,
    tradeType: p.tradeType
  })));
}
main().catch(console.error).finally(() => prisma.$disconnect());

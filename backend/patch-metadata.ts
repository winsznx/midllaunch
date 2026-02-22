import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const records = [
    { "name": "My Doll", "symbol": "MYDL", "description": "My Doll", "image": "ipfs://bafkreiftpdvcvb6ju3m5adp6vagikfgl2a2hlt5ogm7c7axrj54uctxyce" },
    { "name": "CHILLGUY", "symbol": "CHG", "description": "Chillguy Nft ", "image": "ipfs://bafkreickzfkkunvyysembd6kvym3so335cknvqgabuqrwhawoqq54sa64e" },
    { "name": "WINSZN", "symbol": "WSM", "description": "Winszn's NFT, founder of midllaunch.", "image": "ipfs://bafkreickkxvvaibjgwedmwxmwugamu66h7b4zibqhdrqfveibs3jogmenq", "external_url": "https://winszn.xyz", "twitter": "https://x.com/winsznx", "telegram": "https://t.me?winszn_x" },
    { "name": "Alpha", "symbol": "APA", "description": "", "image": "ipfs://bafkreig2aknlelxffl2jaxr57lqwvwfooqmxzg62d7eoytgn2u3patcd4u" },
    { "name": "Chicken", "symbol": "CHI", "description": "", "image": "ipfs://bafkreibtxjxxjlreyvzsstyxa2t7wppsgqrtbw7obmu73zzjbuezyaf4te" },
    { "name": "Git", "symbol": "GITHISTORY", "description": "How git history of unemployed devs look", "image": "ipfs://bafkreibuxtlw7ws2ve2zg66jsiewdluvoc3txrwc64welnmlag4fl5djzm" }
];

async function main() {
    for (const record of records) {
        const { name, symbol, description, image, external_url, twitter, telegram } = record;

        let imageCID = image?.replace('ipfs://', '');
        let imageUrl = imageCID ? `https://gateway.pinata.cloud/ipfs/${imageCID}` : undefined;

        // Check Launch
        const launch = await prisma.launch.findFirst({ where: { name, symbol } });
        if (launch) {
            await prisma.launch.update({
                where: { id: launch.id },
                data: {
                    description: description || undefined,
                    imageUrl,
                    websiteUrl: external_url || undefined,
                    twitterUrl: twitter || undefined,
                    telegramUrl: telegram || undefined,
                }
            });
            console.log(`Updated Launch: ${name} (${symbol})`);
            continue;
        }

        // Check NftLaunch
        const nft = await prisma.nftLaunch.findFirst({ where: { name, symbol } });
        if (nft) {
            await prisma.nftLaunch.update({
                where: { contractAddress: nft.contractAddress },
                data: {
                    description: description || undefined,
                    imageUrl,
                    websiteUrl: external_url || undefined,
                    twitterUrl: twitter || undefined,
                    telegramUrl: telegram || undefined,
                }
            });
            console.log(`Updated NftLaunch: ${name} (${symbol})`);
            continue;
        }

        console.log(`Not found in DB: ${name} (${symbol})`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

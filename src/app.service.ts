import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { initSdk, txVersion } from './config';
import { PublicKey } from '@solana/web3.js';
import { NATIVE_MINT } from '@solana/spl-token';
import BN from 'bn.js';
import {
  AmmV4Keys,
  ApiV3PoolInfoStandardItem,
} from '@raydium-io/raydium-sdk-v2';
import { ac } from '@raydium-io/raydium-sdk-v2/lib/api-166c4d45';
import { format } from 'node:path/win32';

@Injectable()
export class AppService {
  constructor(
    private readonly logger: Logger,
    private readonly httpService: HttpService,
  ) {
    // this.queen420Bot();
    this.swapBot();
  }

  getHello(): string {
    return 'Hello World!';
  }

  async swapBot() {
    const poolAddress = new PublicKey(process.env.POOL_ADDRESS);
    this.logger.log('>>> subscribe....');
    this.logger.log('- poolAddress: ' + poolAddress.toBase58());
    const raydium = await initSdk({ loadToken: true });
    const wallet = raydium.owner.publicKey.toBase58();
    const walletx = await raydium.account.fetchWalletTokenAccounts();
    this.logger.log('- wallet: ' + wallet);
    this.logger.log('- wallet: ' + JSON.stringify(walletx));
    // note: api doesn't support get devnet pool info, so in devnet else we go rpc method
    // if you wish to get pool info from rpc, also can modify logic to go rpc method directly
    let amountIn = 0;
    const inputMint = NATIVE_MINT.toBase58();
    const data = await raydium.api.fetchPoolById({
      ids: process.env.POOL_ADDRESS,
    });
    const poolInfo: ApiV3PoolInfoStandardItem | undefined =
      data[0] as ApiV3PoolInfoStandardItem;
    const poolKeys: AmmV4Keys | undefined =
      await raydium.liquidity.getAmmPoolKeys(process.env.POOL_ADDRESS);
    const rpcData = await raydium.liquidity.getRpcPoolInfo(
      process.env.POOL_ADDRESS,
    );
    const [baseReserve, quoteReserve, status] = [
      rpcData.baseReserve,
      rpcData.quoteReserve,
      rpcData.status.toNumber(),
    ];

    const baseIn = inputMint === poolInfo.mintA.address;
    const [mintIn, mintOut] = baseIn
      ? [poolInfo.mintA, poolInfo.mintB]
      : [poolInfo.mintB, poolInfo.mintA];

    const sellAddress = 'Ha3PwnQ9PRCo1RXTqQVgaz2YaPX4N6p5ZiS9NSBzrPbR'
    const buyAddress = 'HHWDKr7z1GgaZZqjofzeJWSauUEA6kVLX9h5Ry6eyABK'
    // sell
    // let txid = '2ZzmEscZR1ga5TQaSxaaWaKZekopVYSLqkgqik552jFmfChAwfeb8kUvBkpMh5vtNSH62hB72BtRsfv1LagNV3TG' // buy
    // txid = '2TaP17CFbht1PvNZbMfnKT6wxruatDGUvkD9xLrmcdbVEdg2iQfk7PJNv3ikguoJCbWuXXJFW7xtDBHLYfgpA6f6' // sell
    // txid = '2ZzmEscZR1ga5TQaSxaaWaKZekopVYSLqkgqik552jFmfChAwfeb8kUvBkpMh5vtNSH62hB72BtRsfv1LagNV3TG' // buy
    // const txs = await raydium.connection.getParsedTransaction(txid, {
    //   commitment: 'confirmed',
    //   maxSupportedTransactionVersion: 1,
    // })
    // txs.meta.innerInstructions.forEach((innerInstruction, index1) => {
    //   innerInstruction.instructions.forEach((item, index2) => {
    //     if(item['parsed'] && item['parsed']['type'] === 'transfer' && item['parsed']['info']['amount']) {
    //       console.log('item.index 1/2: ', `${index1}/${index2}`);
    //       if (item['parsed']['info']['destination'] === sellAddress) {
    //         console.log('SELL.....')
    //         console.log('from: ', innerInstruction.instructions[index2]['parsed']['info']);
    //         console.log('to: ', innerInstruction.instructions[index2+1]['parsed']['info']);
    //       } else if (item['parsed']['info']['destination'] === buyAddress) {
    //         console.log('BUY.....')
    //         console.log('from: ', innerInstruction.instructions[index2]['parsed']['info']);
    //         console.log('to: ', innerInstruction.instructions[index2+1]['parsed']['info']);
    //       }
    //     }
    //   })
    // })
    raydium.connection.onLogs(
      poolAddress,
      async (data) => {
        try {
          console.log('>>> onLog.... ');
        console.log('- signature: ', data.signature);
        // Get trasaction from rpc
        const txs = await raydium.connection.getParsedTransaction(data.signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 1,
        })
        let action = ''
        let wallet = ''
        let from = ''
        let to = ''
        txs.meta.innerInstructions.forEach((innerInstruction, index1) => {
          innerInstruction.instructions.forEach((item, index2) => {
            if (item['parsed'] && item['parsed']['type'] === 'transfer' && item['parsed']['info']['amount']) {
              console.log('item.index 1/2: ', `${index1}/${index2}`);
              if (item['parsed']['info']['destination'] === sellAddress) {
                console.log('SELL.....')
                console.log('from: ', innerInstruction.instructions[index2]['parsed']['info']);
                console.log('to: ', innerInstruction.instructions[index2 + 1]['parsed']['info']);
                action = 'SELL'
                wallet = innerInstruction.instructions[index2]['parsed']['info']['authority']
                from = Number(innerInstruction.instructions[index2]['parsed']['info']['amount']) / 1000000 + ' Q420'
                to = Number(innerInstruction.instructions[index2 + 1]['parsed']['info']['amount']) / 1000000000 + ' SOL'
              } else if (item['parsed']['info']['destination'] === buyAddress) {
                console.log('BUY.....')
                console.log('from: ', innerInstruction.instructions[index2]['parsed']['info']);
                console.log('to: ', innerInstruction.instructions[index2 + 1]['parsed']['info']);
                action = 'BUY'
                wallet = innerInstruction.instructions[index2]['parsed']['info']['authority']
                from = Number(innerInstruction.instructions[index2]['parsed']['info']['amount']) / 1000000000 + ' SOL'
                to = Number(innerInstruction.instructions[index2 + 1]['parsed']['info']['amount']) / 1000000 + ' Q420'
              }
            }
          })
        })
        const tx = await raydium.connection.getParsedTransaction(
          data.signature,
          {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 1,
          },
        );
        // hook
        const color = action === 'BUY' ? 5763719 : 15548997;
        await this.httpService.axiosRef.post(
          process.env.DISCORO_WEBHOOK_URL,
          {
            content: null,
            embeds: [
              {
                title: `Raydium Bot v0.0.2 Detection`,
                color,
                fields: [
                  {
                    name: 'Timestamp',
                    value: `${new Date().toLocaleString()}`,
                  },
                  {
                    name: 'Action',
                    value:
                      `${action}`,
                  },
                  {
                    name: 'Wallet',
                    value: `[${wallet}](https://solscan.io/account/${wallet})`,
                  },
                  {
                    name: 'From',
                    value:
                      `${from}`,
                  }, {
                    name: 'to',
                    value:
                      `${to}`,
                  },
                  {
                    name: 'Tx',
                    value:
                      `[View on Solscan](https://solscan.io/tx/${data.signature})`,
                  },
                ],
                footer: {
                  text: `Power by Queen420 Dev`,
                },
              },
            ],
            username: 'Q420-Bot',
            avatar_url:
              'https://img-v1.raydium.io/icon/CCmBbDh6imohws6epvjHLmMsXMH4vBmaF5tKZReZpump.png',
            attachments: [],
          },
          {
            headers: {
              'Content-Type': 'application/json; charset=UTF-8',
            },
          },
        );
        } catch (error) {
          console.log('onLogError: ', error)
        }
      },
      'confirmed',
    );
  }

  async queen420Bot() {
    const poolAddress = new PublicKey(process.env.POOL_ADDRESS);
    this.logger.log('>>> queen420Bot....');
    this.logger.log('- poolAddress: ' + poolAddress.toBase58());
    const raydium = await initSdk({ loadToken: true });
    const wallet = raydium.owner.publicKey.toBase58();
    const walletx = await raydium.account.fetchWalletTokenAccounts();
    this.logger.log('- wallet: ' + wallet);
    this.logger.log('- wallet: ' + JSON.stringify(walletx));
    raydium.connection.onAccountChange(
      poolAddress,
      async (accountInfo, context) => {
        console.log('Account changed!');
        console.log('Account Info:', accountInfo.data);

        // คุณสามารถตรวจสอบข้อมูลจากบัญชี (account data) ได้ที่นี่
        // เช่น ตรวจสอบว่ามีคำสั่งซื้อหรือ Swap ใด ๆ เข้ามาหรือไม่

        // ตัวอย่าง: ตรวจสอบธุรกรรมล่าสุด
        // const transactionSignature = context.slot.toString();
        // const txStatus = await raydium.connection.getTransaction(
        //   transactionSignature,
        //   {
        //     commitment: 'confirmed',
        //   },
        // );

        // console.log('Transaction Status:', txStatus);
      },
      'confirmed', // ระบุ commitment level
    );
  }

  async queen420Botx() {
    this.logger.log('>>> raydiumBot....');
    const pool1 = process.env.POOL_ADDRESS;
    const raydium = await initSdk();

    // Q420-SOL
    let priceBefore = 0;
    while (true) {
      try {
        const res = await raydium.liquidity.getRpcPoolInfos([pool1]);
        const pool1Info = res[pool1];
        const res2 = await raydium.api.fetchPoolById({
          ids: pool1,
        });
        // console.log('raydium.api.fetchPoolById:', raydium.api.urlConfigs);
        // console.log(res2[0].mintAmountA / res2[0].mintAmountB);
        const priceCurrent = Number(pool1Info.poolPrice);
        const priceDiff = priceBefore - priceCurrent;
        this.logger.log('- priceCurrent: ' + priceCurrent);
        this.logger.log('- priceBefore: ' + priceBefore);
        this.logger.log('- priceDiff: ' + priceDiff);
        if (priceBefore != Number(pool1Info.poolPrice) && priceBefore != 0) {
          const color = priceDiff > 0 ? 5763719 : 15548997;
          await this.httpService.axiosRef.post(
            process.env.DISCORO_WEBHOOK_URL,
            {
              content: null,
              embeds: [
                {
                  title: `Queen420-SOL Price`,
                  color,
                  fields: [
                    {
                      name: 'เวลา',
                      value: `${new Date().toLocaleString()}`,
                    },
                    {
                      name: 'ราคาปัจจุบัน',
                      value: `${pool1Info.poolPrice}`,
                    },
                    {
                      name: 'ราคาก่อนหน้า',
                      value: `${priceBefore}`,
                    },
                    {
                      name: 'ราคาต่างกัน',
                      value: `${priceDiff}`,
                    },
                    {
                      name: 'มูลค่ารวม',
                      value: `${res2[0].tvl}`,
                    },
                    {
                      name: 'ราคา ต่ำสุด / สูงสุด (รายวัน)',
                      value: `${res2[0].day.priceMin.toFixed(2)} / ${res2[0].day.priceMax.toFixed(2)}`,
                    },
                    {
                      name: 'volume (Q420)',
                      value: `${res2[0].day.volumeQuote}`,
                    },
                  ],
                  footer: {
                    text: `Queen420 Bot v0.0.1`,
                  },
                },
              ],
              username: 'Test Bot',
              avatar_url:
                'https://img-v1.raydium.io/icon/CCmBbDh6imohws6epvjHLmMsXMH4vBmaF5tKZReZpump.png',
              attachments: [],
            },
            {
              headers: {
                'Content-Type': 'application/json; charset=UTF-8',
              },
            },
          );
        }
        priceBefore = Number(pool1Info.poolPrice);
      } catch (error) {
        this.logger.error(error);
      }
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

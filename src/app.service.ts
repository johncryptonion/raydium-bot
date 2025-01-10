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
    raydium.connection.onLogs(
      poolAddress,
      async (data) => {
        console.log('>>> onLogs....');
        let swapData = data.logs.find((item) => item.includes('Swap'));
        if (!swapData) return;
        swapData = swapData
          .substring(swapData.indexOf('{') - 1)
          .replace(/(\w+):/g, '"$1":');
        const swapDataJson = JSON.parse(swapData);
        console.log('- swapData: ', swapDataJson);
        let state = 'NONE';
        if (swapDataJson.amount_in > swapDataJson.minimum_amount_out) {
          console.log('>>> Sell');
          state = 'SELL';
        } else {
          console.log('>>> Buy');
          state = 'BUY';
          amountIn =
            Number(swapDataJson.amount_in) +
            Number(swapDataJson.amount_in * 0.05);
          const out = raydium.liquidity.computeAmountOut({
            poolInfo: {
              ...poolInfo,
              baseReserve,
              quoteReserve,
              status,
              version: 4,
            },
            amountIn: new BN(amountIn),
            mintIn: mintIn.address,
            mintOut: mintOut.address,
            slippage: 0.01, // range: 1 ~ 0.0001, means 100% ~ 0.01%
          });
          console.log('- amountInOrigin: ', swapDataJson.amount_in);
          console.log(
            '- minAmountOutOrigin: ',
            swapDataJson.minimum_amount_out,
          );
          console.log('- amountIn: ', amountIn);
          console.log('- minAmountOut: ', Number(out.minAmountOut.toString()));
          console.log('- mintIn.address: ', mintIn.address);
          console.log('- mintOut.address: ', mintOut.address);
          // const { execute } = await raydium.liquidity.swap({
          //   poolInfo,
          //   poolKeys,
          //   amountIn: new BN(amountIn),
          //   amountOut: 0, // out.amountOut means amount 'without' slippage
          //   fixedSide: 'in',
          //   inputMint: mintIn.address,
          //   txVersion,
          //   // optional: set up token account
          //   // config: {
          //   //   inputUseSolBalance: true, // default: true, if you want to use existed wsol token account to pay token in, pass false
          //   //   outputUseSolBalance: true, // default: true, if you want to use existed wsol token account to receive token out, pass false
          //   //   associatedOnly: true, // default: true, if you want to use ata only, pass true
          //   // },

          //   // optional: set up priority fee here
          //   computeBudgetConfig: {
          //     units: 1000000,
          //     microLamports: 500000,
          //   },
          // });
          // don't want to wait confirm, set sendAndConfirm to false or don't pass any params to execute
          // try {
          //   const { txId } = await execute({
          //     sendAndConfirm: true,
          //     skipPreflight: true,
          //   });
          //   console.log(
          //     `swap successfully in amm pool: https://solscan.io/tx/${txId.toString()}`,
          //   );
          // } catch (error) {
          //   console.error(error);
          // }
        }
        // get signature
        const tx = await raydium.connection.getParsedTransaction(
          data.signature,
          {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 1,
          },
        );
        const signer =
          tx?.meta?.innerInstructions[0].instructions[0]['parsed']['info'][
            'wallet'
          ];
        // hook
        const color = state === 'BUY' ? 5763719 : 15548997;
        await this.httpService.axiosRef.post(
          process.env.DISCORO_WEBHOOK_URL,
          {
            content: null,
            embeds: [
              {
                title: `Raydium Bot v0.0.1 Detection`,
                color,
                fields: [
                  {
                    name: 'Timestamp',
                    value: `${new Date().toLocaleString()}`,
                  },
                  {
                    name: 'Action',
                    value:
                      `${state} : ` +
                      (state === 'BUY'
                        ? `${(swapDataJson.minimum_amount_out / 1000000).toFixed(2)} Q420 = ${(
                            swapDataJson.amount_in / 1000000000
                          ).toFixed(6)} SOL`
                        : `${(swapDataJson.amount_in / 1000000).toFixed(2)} Q420 = ${(
                            swapDataJson.minimum_amount_out / 1000000000
                          ).toFixed(6)} SOL`),
                  },
                  {
                    name: 'Signer',
                    value: `${signer}`,
                  },
                ],
                footer: {
                  text: `Power by Queen420 Dev`,
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

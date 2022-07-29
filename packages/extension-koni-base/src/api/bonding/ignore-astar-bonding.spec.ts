// Copyright 2019-2022 @subwallet/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ValidatorInfo } from '@subwallet/extension-base/background/KoniTypes';
import { ERA_LENGTH_MAP } from '@subwallet/extension-koni-base/api/bonding/utils';
import { PREDEFINED_NETWORKS } from '@subwallet/extension-koni-base/api/predefinedNetworks';
import { DOTSAMA_AUTO_CONNECT_MS } from '@subwallet/extension-koni-base/constants';
import { getCurrentProvider, isUrl, parseRawNumber } from '@subwallet/extension-koni-base/utils/utils';
import fetch from 'cross-fetch';

import { ApiPromise, WsProvider } from '@polkadot/api';
import { SubmittableExtrinsic } from '@polkadot/api/promise/types';
import { BN } from '@polkadot/util';

jest.setTimeout(5000000);

describe('test DotSama APIs', () => {
  test('test get Validator', async () => {
    const provider = new WsProvider(getCurrentProvider(PREDEFINED_NETWORKS.shibuya), DOTSAMA_AUTO_CONNECT_MS);
    const api = new ApiPromise({ provider });
    const apiPromise = await api.isReady;
    const address = 'b6dCDjD46DHpikSDoAPt8Hw1r1SZfbwpi2AkX8z3xunvD4A';
    const decimals = 18;

    const rawMaxStakerPerContract = (apiPromise.consts.dappsStaking.maxNumberOfStakersPerContract).toHuman() as string;
    const rawMinStake = (apiPromise.consts.dappsStaking.minimumStakingAmount).toHuman() as string;

    const result: ValidatorInfo[] = [];
    const minStake = parseRawNumber(rawMinStake);
    const maxStakerPerContract = parseRawNumber(rawMaxStakerPerContract);

    console.log(maxStakerPerContract);
    const allDappsReq = new Promise(function (resolve) {
      fetch('https://api.astar.network/api/v1/shibuya/dapps-staking/dapps', {
        method: 'GET'
      }).then((resp) => {
        resolve(resp.json());
      }).catch(console.error);
    });

    const [_stakedDapps, _era, _allDapps] = await Promise.all([
      apiPromise.query.dappsStaking.generalStakerInfo.entries(address),
      apiPromise.query.dappsStaking.currentEra(),
      allDappsReq
    ]);

    const stakedDappsList: string[] = [];

    for (const item of _stakedDapps) {
      const data = item[0].toHuman() as any[];
      const stakedDapp = data[1] as Record<string, string>;

      stakedDappsList.push(stakedDapp.Evm);
    }

    const era = parseRawNumber(_era.toHuman() as string);
    const allDapps = _allDapps as Record<string, any>[];

    await Promise.all(allDapps.map(async (dapp) => {
      const dappName = dapp.name as string;
      const dappAddress = dapp.address as string;
      const dappIcon = isUrl(dapp.iconUrl as string) ? dapp.iconUrl as string : undefined;
      const _contractInfo = await apiPromise.query.dappsStaking.contractEraStake({ Evm: dappAddress }, era);
      const contractInfo = _contractInfo.toHuman() as Record<string, any>;
      const totalStake = parseRawNumber(contractInfo.total as string);
      const stakerCount = parseRawNumber(contractInfo.numberOfStakers as string);

      result.push({
        address: dappAddress,
        totalStake,
        ownStake: 0,
        otherStake: totalStake,
        nominatorCount: stakerCount,
        // to be added later
        commission: 0,
        expectedReturn: 0,
        blocked: false,
        isVerified: false,
        minBond: (minStake / 10 ** decimals),
        isNominated: stakedDappsList.includes(address),
        icon: dappIcon,
        identity: dappName
      });
    }));

    console.log(result);
  });

  test('test get APR', async () => {
    const resp = await fetch('https://api.astar.network/api/v1/shibuya/dapps-staking/apr', {
      method: 'GET'
    }).then((resp) => resp.json()) as number;

    console.log(resp);
  });

  test('test get bonding extrinsic', async () => {
    const provider = new WsProvider(getCurrentProvider(PREDEFINED_NETWORKS.shibuya), DOTSAMA_AUTO_CONNECT_MS);
    const api = new ApiPromise({ provider });
    const apiPromise = await api.isReady;
    const dappAddress = '0x1CeE94a11eAf390B67Aa346E9Dda3019DfaD4f6A';
    const address = 'b6dCDjD46DHpikSDoAPt8Hw1r1SZfbwpi2AkX8z3xunvD4A';

    const extrinsic = apiPromise.tx.dappsStaking.bondAndStake({ Evm: dappAddress }, new BN(1));

    console.log(extrinsic.paymentInfo(address));
  });

  test('test get unbonding extrinsic', async () => {
    const provider = new WsProvider(getCurrentProvider(PREDEFINED_NETWORKS.shibuya), DOTSAMA_AUTO_CONNECT_MS);
    const api = new ApiPromise({ provider });
    const apiPromise = await api.isReady;
    const dappAddress = '0x1CeE94a11eAf390B67Aa346E9Dda3019DfaD4f6A';
    const address = 'b6dCDjD46DHpikSDoAPt8Hw1r1SZfbwpi2AkX8z3xunvD4A';

    const extrinsic = apiPromise.tx.dappsStaking.unbondAndUnstake({ Evm: dappAddress }, new BN(1));

    console.log(extrinsic.paymentInfo(address));
  });

  test('test get unlocking info', async () => {
    const provider = new WsProvider(getCurrentProvider(PREDEFINED_NETWORKS.shibuya), DOTSAMA_AUTO_CONNECT_MS);
    const api = new ApiPromise({ provider });
    const apiPromise = await api.isReady;
    const address = '5HbcGs2QXVAc6Q6eoTzLYNAJWpN17AkCFRLnWDaHCiGYXvNc';

    const [_stakingInfo, _era] = await Promise.all([
      apiPromise.query.dappsStaking.ledger(address),
      apiPromise.query.dappsStaking.currentEra()
    ]);

    const currentEra = parseRawNumber(_era.toHuman() as string);
    const stakingInfo = _stakingInfo.toHuman() as Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const unlockingChunks = stakingInfo.unbondingInfo.unlockingChunks as Record<string, string>[];

    let nextWithdrawalEra = -1;
    let nextWithdrawalAmount = 0;
    let redeemable = 0;

    for (const chunk of unlockingChunks) {
      const unlockEra = parseRawNumber(chunk.unlockEra);
      const amount = parseRawNumber(chunk.amount);

      console.log('chunk', chunk);

      if (nextWithdrawalEra === -1) {
        nextWithdrawalEra = unlockEra;
        nextWithdrawalAmount = amount;
      } else if (unlockEra <= nextWithdrawalEra) {
        nextWithdrawalEra = unlockEra;
        nextWithdrawalAmount += amount;
      }

      // Find redeemable
      if (unlockEra - currentEra <= 0) {
        console.log('unlockEra', unlockEra);
        redeemable += amount;
      }
    }

    const nextWithdrawal = (nextWithdrawalEra - currentEra) * ERA_LENGTH_MAP.shibuya;

    console.log(currentEra);
    console.log(nextWithdrawal);
    console.log(nextWithdrawalAmount);
    console.log(redeemable);
  });

  test('test get withdraw extrinsic', async () => {
    const provider = new WsProvider(getCurrentProvider(PREDEFINED_NETWORKS.shibuya), DOTSAMA_AUTO_CONNECT_MS);
    const api = new ApiPromise({ provider });
    const apiPromise = await api.isReady;
    const address = 'b6dCDjD46DHpikSDoAPt8Hw1r1SZfbwpi2AkX8z3xunvD4A';

    const extrinsic = apiPromise.tx.dappsStaking.withdrawUnbonded();

    console.log(extrinsic.paymentInfo(address));
  });

  test('test get unclaimed eras', async () => {
    const provider = new WsProvider(getCurrentProvider(PREDEFINED_NETWORKS.shibuya), DOTSAMA_AUTO_CONNECT_MS);
    const api = new ApiPromise({ provider });
    const apiPromise = await api.isReady;
    const address = '5HbcGs2QXVAc6Q6eoTzLYNAJWpN17AkCFRLnWDaHCiGYXvNc';

    const [_stakedDapps, _currentEra] = await Promise.all([
      apiPromise.query.dappsStaking.generalStakerInfo.entries(address),
      apiPromise.query.dappsStaking.currentEra()
    ]);

    const currentEra = parseRawNumber(_currentEra.toHuman() as string);
    const transactions: SubmittableExtrinsic[] = [];

    for (const item of _stakedDapps) {
      const data = item[0].toHuman() as any[];
      const stakedDapp = data[1] as Record<string, string>;
      const stakeData = item[1].toHuman() as Record<string, Record<string, string>[]>;
      const stakes = stakeData.stakes;
      const dappAddress = stakedDapp.Evm.toLowerCase();

      let numberOfUnclaimedEra = 0;

      for (let i = 0; i < stakes.length; i++) {
        const { era, staked } = stakes[i];
        const bnStaked = new BN(staked.replaceAll(',', ''));
        const parsedEra = parseRawNumber(era);

        if (bnStaked.eq(new BN(0))) {
          continue;
        }

        const nextEraData = stakes[i + 1] ?? null;
        const nextEra = nextEraData && parseRawNumber(nextEraData.era);
        const isLastEra = i === stakes.length - 1;
        const eraToClaim = isLastEra ? currentEra - parsedEra : nextEra - parsedEra;

        numberOfUnclaimedEra += eraToClaim;
      }

      for (let i = 0; i < numberOfUnclaimedEra; i++) {
        const tx = apiPromise.tx.dappsStaking.claimStaker({ Evm: dappAddress });

        transactions.push(tx);
      }
    }

    const extrinsic = apiPromise.tx.utility.batch(transactions);

    const paymentInfo = await extrinsic.paymentInfo(address);

    console.log(paymentInfo.toHuman());
  });
});

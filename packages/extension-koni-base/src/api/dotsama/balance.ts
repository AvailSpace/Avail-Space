// Copyright 2019-2022 @koniverse/extension-koni-base authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ethereumChains, moonbeamBaseChains } from '@koniverse/extension-koni-base/api/dotsama/api-helper';
import { getRegistry, getTokenInfo } from '@koniverse/extension-koni-base/api/dotsama/registry';
import { getEVMBalance } from '@koniverse/extension-koni-base/api/web3/balance';
import { getERC20Contract } from '@koniverse/extension-koni-base/api/web3/web3';
import { dotSamaAPIMap } from '@koniverse/extension-koni-base/background/handlers';
import { APIItemState, ApiProps, BalanceChildItem, BalanceItem, TokenBalanceRaw, TokenInfo } from '@koniverse/extension-koni-base/background/types';
import { ASTAR_REFRESH_BALANCE_INTERVAL, IGNORE_GET_SUBSTRATE_FEATURES_LIST, MOONBEAM_REFRESH_BALANCE_INTERVAL } from '@koniverse/extension-koni-base/constants';
import { categoryAddresses, sumBN } from '@koniverse/extension-koni-base/utils/utils';
import { Observable } from 'rxjs';
import { Contract } from 'web3-eth-contract';

import { ApiPromise } from '@polkadot/api';
import { UnsubscribePromise } from '@polkadot/api/types';
import { DeriveBalancesAll } from '@polkadot/api-derive/types';
import { AccountInfo } from '@polkadot/types/interfaces';
import { BN } from '@polkadot/util';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-ignore
function subscribeWithDerive (addresses: string[], networkKey: string, networkAPI: ApiProps, callback: (networkKey: string, rs: BalanceItem) => void) {
  const freeMap: Record<string, BN> = {};
  const reservedMap: Record<string, BN> = {};
  const miscFrozenMap: Record<string, BN> = {};
  const feeFrozenMap: Record<string, BN> = {};

  const unsubProms = addresses.map((address) => {
    return networkAPI.api.derive.balances?.all(address, (balance: DeriveBalancesAll) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      freeMap[address] = balance.freeBalance?.toBn() || new BN(0);
      reservedMap[address] = balance.reservedBalance?.toBn() || new BN(0);
      miscFrozenMap[address] = balance.frozenMisc?.toBn() || new BN(0);
      feeFrozenMap[address] = balance.frozenFee?.toBn() || new BN(0);

      const balanceItem = {
        state: APIItemState.READY,
        free: sumBN(Object.values(freeMap)).toString(),
        reserved: sumBN(Object.values(reservedMap)).toString(),
        miscFrozen: sumBN(Object.values(miscFrozenMap)).toString(),
        feeFrozen: sumBN(Object.values(feeFrozenMap)).toString()
      } as BalanceItem;

      callback(networkKey, balanceItem);
    });
  });

  return async () => {
    const unsubs = await Promise.all(unsubProms);

    unsubs.forEach((unsub) => {
      unsub && unsub();
    });
  };
}

function subscribeERC20Interval (addresses: string[], networkKey: string, api: ApiPromise, originBalanceItem: BalanceItem, callback: (networkKey: string, rs: BalanceItem) => void): () => void {
  let tokenList = {} as TokenInfo[];
  const ERC20ContractMap = {} as Record<string, Contract>;
  const tokenBalanceMap = {} as Record<string, BalanceChildItem>;

  const getTokenBalances = () => {
    Object.values(tokenList).map(async ({ decimals, symbol }) => {
      let free = new BN(0);

      try {
        const contract = ERC20ContractMap[symbol];
        const bals = await Promise.all(addresses.map((address): Promise<string> => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
          return contract.methods.balanceOf(address).call();
        }));

        free = sumBN(bals.map((bal) => new BN(bal || 0)));
        // console.log('TokenBals', symbol, addresses, bals, free);

        tokenBalanceMap[symbol] = {
          reserved: '0',
          frozen: '0',
          free: free.toString(),
          decimals
        };
      } catch (err) {
        console.log('There is problem when fetching ' + symbol + ' token balance', err);
      }
    });

    originBalanceItem.children = tokenBalanceMap;
    callback && callback(networkKey, originBalanceItem);
  };

  getRegistry(networkKey, api).then(({ tokenMap }) => {
    tokenList = Object.values(tokenMap).filter(({ erc20Address }) => (!!erc20Address));
    tokenList.forEach(({ erc20Address, symbol }) => {
      if (erc20Address) {
        ERC20ContractMap[symbol] = getERC20Contract(networkKey, erc20Address);
      }
    });
    getTokenBalances();
  }).catch(console.error);

  const interval = setInterval(getTokenBalances, MOONBEAM_REFRESH_BALANCE_INTERVAL);

  return () => {
    clearInterval(interval);
  };
}

function subscribeTokensBalance (addresses: string[], networkKey: string, api: ApiPromise, originBalanceItem: BalanceItem, callback: (rs: BalanceItem) => void, includeMainToken?: boolean) {
  let forceStop = false;

  let unsubAll = () => {
    forceStop = true;
  };

  originBalanceItem.children = originBalanceItem.children || {};

  getRegistry(networkKey, api)
    .then(({ tokenMap }) => {
      if (forceStop) {
        return;
      }

      let tokenList = Object.values(tokenMap);

      if (!includeMainToken) {
        tokenList = tokenList.filter((t) => !t.isMainToken);
      }

      if (tokenList.length > 0) {
        console.log('Get tokens balance of', networkKey, tokenList);
      }

      const unsubList = tokenList.map(({ decimals, specialOption, symbol }) => {
        const observable = new Observable<BalanceChildItem>((subscriber) => {
          // Get Token Balance
          // @ts-ignore
          const apiCall = api.query.tokens.accounts.multi(addresses.map((address) => [address, options]), (balances: TokenBalanceRaw[]) => {
            const tokenBalance = {
              reserved: sumBN(balances.map((b) => (b.reserved || new BN(0)))).toString(),
              frozen: sumBN(balances.map((b) => (b.frozen || new BN(0)))).toString(),
              free: sumBN(balances.map((b) => (b.free || new BN(0)))).toString(),
              decimals
            };

            subscriber.next(tokenBalance);
          });
        });
        const options = specialOption || { Token: symbol };

        return observable.subscribe({
          next: (childBalance) => {
            if (includeMainToken && tokenMap[symbol].isMainToken) {
              originBalanceItem.state = APIItemState.READY;
              originBalanceItem.free = childBalance.free;
              originBalanceItem.reserved = childBalance.reserved;
              originBalanceItem.feeFrozen = childBalance.frozen;
            } else {
              // @ts-ignore
              originBalanceItem.children[symbol] = childBalance;
            }

            callback(originBalanceItem);
          }
        });
      });

      unsubAll = () => {
        unsubList.forEach((unsub) => {
          unsub && unsub.unsubscribe();
        });
      };
    })
    .catch(console.error);

  return unsubAll;
}

function subscribeAssetsBalance (addresses: string[], networkKey: string, api: ApiPromise, originBalanceItem: BalanceItem, callback: (rs: BalanceItem) => void) {
  let forceStop = false;

  let unsubAll = () => {
    forceStop = true;
  };

  originBalanceItem.children = originBalanceItem.children || {};

  getRegistry(networkKey, api)
    .then(({ tokenMap }) => {
      if (forceStop) {
        return;
      }

      let tokenList = Object.values(tokenMap);

      tokenList = tokenList.filter((t) => !t.isMainToken && t.assetIndex);

      if (tokenList.length > 0) {
        console.log('Get tokens assets of', networkKey, tokenList);
      }

      const unsubList = tokenList.map(({ assetIndex, decimals, symbol }) => {
        const observable = new Observable<BalanceChildItem>((subscriber) => {
          // Get Token Balance
          // @ts-ignore
          const apiCall = api.query.assets.account.multi(addresses.map((address) => [assetIndex, address]), (balances) => {
            let free = new BN(0);
            let frozen = new BN(0);

            balances.forEach((b) => {
              // @ts-ignore
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment
              const bdata = b?.toJSON();

              if (bdata) {
                // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
                const addressBalance = new BN(String(bdata?.balance) || '0');

                // @ts-ignore
                if (bdata?.isFrozen) {
                  frozen = frozen.add(addressBalance);
                } else {
                  free = free.add(addressBalance);
                }
              }
            });

            const tokenBalance = {
              reserved: '0',
              frozen: frozen.toString(),
              free: free.toString(),
              decimals
            };

            subscriber.next(tokenBalance);
          });
        });

        return observable.subscribe({
          next: (childBalance) => {
            // @ts-ignore
            originBalanceItem.children[symbol] = childBalance;

            callback(originBalanceItem);
          }
        });
      });

      unsubAll = () => {
        unsubList.forEach((unsub) => {
          unsub && unsub.unsubscribe();
        });
      };
    })
    .catch(console.error);

  return unsubAll;
}

function subscribeWithAccountMulti (addresses: string[], networkKey: string, networkAPI: ApiProps, callback: (networkKey: string, rs: BalanceItem) => void) {
  const balanceItem: BalanceItem = {
    state: APIItemState.PENDING,
    free: '0',
    reserved: '0',
    miscFrozen: '0',
    feeFrozen: '0',
    children: undefined
  };

  // @ts-ignore
  let unsub: UnsubscribePromise;

  if (!['kintsugi', 'interlay', 'kintsugi_test'].includes(networkKey)) {
    unsub = networkAPI.api.query.system.account.multi(addresses, (balances: AccountInfo[]) => {
      let [free, reserved, miscFrozen, feeFrozen] = [new BN(0), new BN(0), new BN(0), new BN(0)];

      balances.forEach((balance: AccountInfo) => {
        free = free.add(balance.data?.free?.toBn() || new BN(0));
        reserved = reserved.add(balance.data?.reserved?.toBn() || new BN(0));
        miscFrozen = miscFrozen.add(balance.data?.miscFrozen?.toBn() || new BN(0));
        feeFrozen = feeFrozen.add(balance.data?.feeFrozen?.toBn() || new BN(0));
      });

      balanceItem.state = APIItemState.READY;
      balanceItem.free = free.toString();
      balanceItem.reserved = reserved.toString();
      balanceItem.miscFrozen = miscFrozen.toString();
      balanceItem.feeFrozen = feeFrozen.toString();

      callback(networkKey, balanceItem);
    });
  }

  let unsub2: () => void;

  if (['bifrost', 'acala', 'karura'].includes(networkKey)) {
    unsub2 = subscribeTokensBalance(addresses, networkKey, networkAPI.api, balanceItem, (balanceItem) => {
      callback(networkKey, balanceItem);
    });
  } else if (['kintsugi', 'interlay', 'kintsugi_test'].includes(networkKey)) {
    unsub2 = subscribeTokensBalance(addresses, networkKey, networkAPI.api, balanceItem, (balanceItem) => {
      callback(networkKey, balanceItem);
    }, true);
  } else if (['statemine'].indexOf(networkKey) > -1) {
    unsub2 = subscribeAssetsBalance(addresses, networkKey, networkAPI.api, balanceItem, (balanceItem) => {
      callback(networkKey, balanceItem);
    });
  } else if (moonbeamBaseChains.indexOf(networkKey) > -1) {
    unsub2 = subscribeERC20Interval(addresses, networkKey, networkAPI.api, balanceItem, callback);
  }

  return async () => {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    unsub && (await unsub)();
    unsub2 && unsub2();
  };
}

export function subscribeEVMBalance (networkKey: string, api: ApiPromise, addresses: string[], callback: (networkKey: string, rs: BalanceItem) => void) {
  const balanceItem = {
    state: APIItemState.PENDING,
    free: '0',
    reserved: '0',
    miscFrozen: '0',
    feeFrozen: '0'
  } as BalanceItem;

  function getBalance () {
    getEVMBalance(networkKey, addresses)
      .then((balances) => {
        balanceItem.free = sumBN(balances.map((b) => (new BN(b || '0')))).toString();
        balanceItem.state = APIItemState.READY;
        callback(networkKey, balanceItem);
      })
      .catch(console.error);
  }

  getBalance();
  const interval = setInterval(getBalance, ASTAR_REFRESH_BALANCE_INTERVAL);
  const unsub2 = subscribeERC20Interval(addresses, networkKey, api, balanceItem, callback);

  return () => {
    clearInterval(interval);
    unsub2 && unsub2();
  };
}

export function subscribeBalance (addresses: string[], dotSamaAPIMap: Record<string, ApiProps>, callback: (networkKey: string, rs: BalanceItem) => void) {
  const [substrateAddresses, evmAddresses] = categoryAddresses(addresses);

  return Object.entries(dotSamaAPIMap).map(async ([networkKey, apiProps]) => {
    const networkAPI = await apiProps.isReady;
    const useAddresses = ethereumChains.indexOf(networkKey) > -1 ? evmAddresses : substrateAddresses;

    if (networkKey === 'astarEvm' || networkKey === 'shidenEvm') {
      return subscribeEVMBalance(networkKey, networkAPI.api, useAddresses, callback);
    }

    if (!useAddresses || useAddresses.length === 0 || IGNORE_GET_SUBSTRATE_FEATURES_LIST.indexOf(networkKey) > -1) {
      // Return zero balance if not have any address
      const zeroBalance = {
        state: APIItemState.READY,
        free: '0',
        reserved: '0',
        miscFrozen: '0',
        feeFrozen: '0'
      } as BalanceItem;

      callback(networkKey, zeroBalance);

      return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return subscribeWithAccountMulti(useAddresses, networkKey, networkAPI, callback);
  });
}

export async function getFreeBalance (networkKey: string, address: string, token?: string): Promise<string> {
  const apiProps = await dotSamaAPIMap[networkKey].isReady;
  const api = apiProps.api;

  if (token) {
    const tokenInfo = await getTokenInfo(networkKey, api, token);

    if (!(tokenInfo?.isMainToken)) {
      if (moonbeamBaseChains.indexOf(networkKey) > -1 && tokenInfo?.erc20Address) {
        const contract = getERC20Contract(networkKey, tokenInfo.erc20Address);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        const free = await contract.methods.balanceOf(address).call();

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
        return free?.toString() || '0';
      } else {
        // @ts-ignore
        const balance = await api.query.tokens.accounts(address, tokenInfo?.specialOption || { Token: token }) as TokenBalanceRaw;

        return balance.free?.toString() || '0';
      }
    }
  }

  if (networkKey === 'kintsugi') {
    const balance = await api.derive.balances?.all(address);

    return balance.freeBalance?.toString() || '0';
  } else {
    const balance = await api.query.system.account(address) as AccountInfo;

    return balance.data?.free?.toString() || '0';
  }
}

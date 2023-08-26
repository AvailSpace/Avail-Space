// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { SubWalletEvmProvider } from '@subwallet/extension-base/page/SubWalleEvmProvider';
import { addLazy } from '@subwallet/extension-base/utils';
import { EvmProvider, Injected, InjectedAccountWithMeta, InjectedWindowProvider, Unsubcall } from '@subwallet/extension-inject/types';
import { addInjects, removeInjects } from '@subwallet/extension-koni-ui/messaging';
import { noop, toShort } from '@subwallet/extension-koni-ui/utils';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  children: React.ReactNode;
}

export interface InjectedWindow extends This {
  injectedWeb3?: Record<string, InjectedWindowProvider>;
  ethereum?: EvmProvider;
  SubWallet?: SubWalletEvmProvider;
}

interface InjectContextProps {
  substrateWallet?: Injected;
  evmWallet?: SubWalletEvmProvider;
}

type This = typeof globalThis;
type AccountArrayMap = Record<string, InjectedAccountWithMeta[]>;
type AccountMap = Record<string, InjectedAccountWithMeta>;

const win = window as Window & InjectedWindow;

const evmConvertToInject = (address: string): InjectedAccountWithMeta => {
  return {
    address,
    type: 'ethereum',
    meta: {
      source: 'SubWallet',
      name: toShort(address, 4, 4)
    }
  };
};

const parseAccountMap = (values: AccountArrayMap): InjectedAccountWithMeta[] => {
  const result: AccountMap = {};

  for (const [, array] of Object.entries(values)) {
    for (const account of array) {
      result[account.address] = account;
    }
  }

  return Object.values(result);
};

export const InjectContext = React.createContext<InjectContextProps>({});

const updateStatePromiseKey = 'updateInjectState';
const injectPromiseKey = 'injectAccount';

export const InjectContextProvider: React.FC<Props> = ({ children }: Props) => {
  const [substrateWallet, setSubstrateWallet] = useState<Injected | undefined>();
  const [evmWallet, setEvmWallet] = useState<SubWalletEvmProvider | undefined>();
  const accountsRef = useRef<AccountArrayMap>({});
  const [cacheAccounts, setCacheAccounts] = useState<AccountArrayMap>(accountsRef.current);
  const previousRef = useRef<AccountArrayMap>({});

  const updateState = useCallback(() => {
    addLazy(updateStatePromiseKey, () => {
      setCacheAccounts((prevState) => {
        previousRef.current = prevState;

        return { ...accountsRef.current };
      });
    }, 200, undefined, false);
  }, []);

  const updateInjected = useCallback((oldMap: AccountArrayMap, newMap: AccountArrayMap) => {
    const oldArray = parseAccountMap(oldMap);
    const newArray = parseAccountMap(newMap);

    const addArray: InjectedAccountWithMeta[] = [];
    const removeArray: InjectedAccountWithMeta[] = [];

    for (const account of newArray) {
      const exists = oldArray.find((acc) => acc.address === account.address);

      if (!exists) {
        addArray.push(account);
      } else {
        if (exists.meta.source !== account.meta.source) {
          addArray.push(account);
        }
      }
    }

    for (const account of oldArray) {
      const exists = newArray.some((acc) => acc.address === account.address);

      if (!exists) {
        removeArray.push(account);
      }
    }

    const promises: Array<Promise<unknown>> = [];

    if (addArray.length) {
      promises.push(addInjects(addArray));
    }

    if (removeArray.length) {
      promises.push(removeInjects(removeArray.map((acc) => acc.address)));
    }

    Promise.all(promises).finally(noop);
  }, []);

  useEffect(() => {
    const wallet = win.injectedWeb3?.['subwallet-js'];

    if (wallet) {
      wallet.enable('web-app')
        .then((inject) => {
          setSubstrateWallet(inject);
        })
        .catch(console.warn)
      ;
    }
  }, []);

  useEffect(() => {
    const wallet = win.SubWallet;

    if (wallet) {
      wallet.enable()
        .then(() => {
          setEvmWallet(wallet);
        })
        .catch(console.warn)
      ;
    }
  }, []);

  useEffect(() => {
    let unsubscribe: Unsubcall | undefined;

    if (substrateWallet) {
      unsubscribe = substrateWallet.accounts.subscribe((value) => {
        const newState: AccountArrayMap = { ...accountsRef.current };

        newState['subwallet-js'] = value.map((account) => ({
          address: account.address,
          meta: {
            genesisHash: account.genesisHash,
            name: account.name || toShort(account.address, 4, 4),
            source: 'SubWallet'
          },
          type: account.type
        }));
        accountsRef.current = newState;
        updateState();
      });
    }

    return () => {
      unsubscribe?.();
    };
  }, [substrateWallet, updateState]);

  useEffect(() => {
    const listener = (addresses: string[]) => {
      const newState: AccountArrayMap = { ...accountsRef.current };

      newState.SubWallet = addresses.map((adr) => evmConvertToInject(adr));
      accountsRef.current = newState;

      updateState();
    };

    if (evmWallet) {
      // Some wallet not fire event on first time
      evmWallet.request<string[]>({ method: 'eth_accounts' }).then(listener).catch(console.warn);
      evmWallet.on('accountsChanged', listener);
    }

    return () => {
      evmWallet?.removeListener('accountsChanged', listener);
    };
  }, [evmWallet, updateState]);

  useEffect(() => {
    addLazy(injectPromiseKey, () => {
      updateInjected(previousRef.current, cacheAccounts);
    }, 500, 1000, false);
  }, [cacheAccounts, updateInjected]);

  return (
    <InjectContext.Provider
      value={{
        evmWallet,
        substrateWallet
      }}
    >
      {children}
    </InjectContext.Provider>
  );
};

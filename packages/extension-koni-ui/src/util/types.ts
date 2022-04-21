// Copyright 2019-2022 @polkadot/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import BigN from 'bignumber.js';

import { BalanceItem } from '@polkadot/extension-base/background/KoniTypes';
import { AccountId, AccountIndex, Address } from '@polkadot/types/interfaces';

export type AccountIdIsh = AccountId | AccountIndex | Address | string | Uint8Array | null;

export type AccountInfoByChain = {
  freeBalance: string
  frozenFee: string
  reservedBalance: string
  frozenMisc: string
}

export type AccountInfoItem = {
  networkKey: string;
  tokenDecimals: number[];
  tokenSymbols: string[];
  balanceItem: BalanceItem;
}

export type Info = {
  ss58Format: number
  tokenDecimals?: number[]
  tokenSymbol: string[]
  icon: string
  name: string
}

export type ChainInfo = {
  [key: string]: Info
}

export type BalanceSubInfo = {
  key: string;
  label: string;
  symbol: string;
  balanceValue: BigN;
  convertedBalanceValue: BigN;
  price: BigN;
}

export type AccountInfoByNetwork = {
  key: string;
  networkKey: string;
  networkDisplayName: string;
  networkPrefix: number;
  networkLogo: string;
  networkIconTheme: string;
  address: string;
  formattedAddress: string;
}

export type ChainInfoBrief = {
  key: string;
  networkKey: string;
  networkDisplayName: string;
  networkPrefix: number;
  networkLogo: string;
  networkIconTheme: string;
  numberCollections: number;
}

export type BalanceInfo = {
  symbol: string;
  balanceValue: BigN;
  convertedBalanceValue: BigN;
  detailBalances: BalanceSubInfo[];
  childrenBalances: BalanceSubInfo[];
  price: BigN;
}

export type SearchQuery = {
  balance: string,
  nft: {
    collection: string,
    item: string
  }
}

export type SearchQueryOptional = {
  balance?: string,
  nft?: {
    collection?: string,
    item?: string
  }
}

export type SearchContextData = {
  query: SearchQuery,
  setQuery: (query: SearchQueryOptional) => void
}

// Copyright 2019-2022 @polkadot/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useSelector } from 'react-redux';

import { ALL_ACCOUNT_KEY } from '@polkadot/extension-koni-base/constants';
import { NftType } from '@polkadot/extension-koni-ui/hooks/screen/home/types';
import { _NftCollection } from '@polkadot/extension-koni-ui/Popup/Home/Nfts/types';
import { RootState } from '@polkadot/extension-koni-ui/stores';
import { NFT_GRID_SIZE } from '@polkadot/extension-koni-ui/util';

export default function useFetchNft (page: number, networkKey: string): NftType {
  const { nft: nftReducer, nftCollection: nftCollectionReducer } = useSelector((state: RootState) => state);

  const nftCollections: _NftCollection[] = [];
  const filteredNftCollections: _NftCollection[] = [];
  let from = 0;
  let to = 0;

  const showAll = networkKey.toLowerCase() === ALL_ACCOUNT_KEY.toLowerCase();

  const rawItems = nftReducer?.nftList;
  const rawCollections = nftCollectionReducer.nftCollectionList;

  console.log('rawItems', rawItems);
  console.log('rawCollections', rawCollections);

  for (const collection of rawCollections) {
    const parsedCollection: _NftCollection = {
      collectionId: collection.collectionId,
      collectionName: collection.collectionName,
      image: collection.image,
      chain: collection.chain,
      nftItems: []
    };

    for (const item of rawItems) {
      if (item.collectionId === collection.collectionId) {
        parsedCollection.nftItems.push(item);
      }
    }

    nftCollections.push(parsedCollection);
  }

  let totalItems = rawItems.length;

  if (!showAll) {
    totalItems = 0;
    nftCollections.forEach((collection) => {
      if (collection.chain && collection.chain === networkKey.toLowerCase()) {
        filteredNftCollections.push(collection);
        totalItems += collection.nftItems.length;
      }
    });
  }

  if (!showAll && filteredNftCollections.length <= NFT_GRID_SIZE) {
    from = 0;
    to = filteredNftCollections.length;
  } else {
    from = (page - 1) * NFT_GRID_SIZE;
    to = from + NFT_GRID_SIZE;
  }

  return {
    nftList: showAll ? nftCollections.slice(from, to) : filteredNftCollections.slice(from, to),
    totalItems,
    totalCollection: showAll ? nftCollections.length : filteredNftCollections.length,
    loading: !nftCollectionReducer.ready // ready = not loading
  } as NftType;
}

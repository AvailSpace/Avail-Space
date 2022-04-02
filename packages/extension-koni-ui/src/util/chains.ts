// Copyright 2019-2022 @polkadot/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { NetworkMetadataDef } from '@polkadot/extension-base/background/KoniTypes';
import NETWORKS from '@polkadot/extension-koni-base/api/endpoints';

function getKnownHashes (): NetworkMetadataDef[] {
  const result: NetworkMetadataDef[] = [];

  Object.keys(NETWORKS).forEach((networkKey) => {
    const { chain, genesisHash, groups, icon, isEthereum, paraId, ss58Format } = NETWORKS[networkKey];

    let isAvailable = true;

    // todo: add more logic in further update
    if (!genesisHash || genesisHash.toLowerCase() === 'unknown') {
      isAvailable = false;
    }

    result.push({
      chain,
      networkKey,
      genesisHash,
      icon: isEthereum ? 'ethereum' : (icon || 'polkadot'),
      ss58Format,
      groups,
      isEthereum: !!isEthereum,
      paraId,
      isAvailable
    });
  });

  return result;
}

const knowHashes: NetworkMetadataDef[] = getKnownHashes();

const hashes = [...knowHashes];

export default hashes;

// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { _STAKING_CHAIN_GROUP } from '@subwallet/extension-base/services/earning-service/constants';
import { YieldPoolType } from '@subwallet/extension-base/types';
import { EarningTagType } from '@subwallet/extension-koni-ui/types';
import { Database, HandsClapping, Leaf, User, Users } from 'phosphor-react';

// todo: after supporting Astar v3, remove this
export function isRelatedToAstar (slug: string) {
  return [
    'ASTR___native_staking___astar',
    'SDN___native_staking___shiden',
    'SBY___native_staking___shibuya',
    'SDN-Shiden',
    'ASTR-Astar',
    'shibuya-NATIVE-SBY'
  ].includes(slug);
}

// todo: About label, will convert to key for i18n later
export const createEarningTypeTags = (chain: string): Record<YieldPoolType, EarningTagType> => {
  return {
    [YieldPoolType.LIQUID_STAKING]: {
      label: 'Liquid staking',
      icon: Leaf,
      color: 'magenta',
      weight: 'bold'
    },
    [YieldPoolType.LENDING]: {
      label: 'Lending',
      icon: HandsClapping,
      color: 'green',
      weight: 'bold'
    },
    [YieldPoolType.SINGLE_FARMING]: {
      label: 'Single farming',
      icon: User,
      color: 'green',
      weight: 'bold'
    },
    [YieldPoolType.NOMINATION_POOL]: {
      label: 'Nomination pool',
      icon: Users,
      color: 'cyan',
      weight: 'bold'
    },
    [YieldPoolType.PARACHAIN_STAKING]: {
      label: 'Parachain staking',
      icon: User,
      color: 'yellow',
      weight: 'bold'
    },
    [YieldPoolType.NATIVE_STAKING]: {
      label: _STAKING_CHAIN_GROUP.astar.includes(chain) ? 'dApp staking' : 'Direct nomination',
      icon: Database,
      color: 'gold',
      weight: 'fill'
    }
  };
};
